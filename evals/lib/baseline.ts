import "./memoryStorage";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { GeneratedDeckSchema } from "@/lib/ai/deckGenerationSchema";
import { deckJsonSchema } from "@/lib/ai/deckJsonSchema";
import { normalizeGeneratedDeck } from "@/lib/ai/normalizeGeneratedDeck";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/ai/openaiClient";
import { toTokenUsage, type TokenUsage } from "@/lib/ai/usage";
import { seedDeck } from "@/lib/seedDeck";
import {
  SlideContentSchema,
  type Deck,
  type Slide,
  type SlideContent,
} from "@/lib/schema/slide";
import { getSlideContent, materializeSlide } from "@/lib/slides/layoutEngine";
import { useDeckStore } from "@/store/deckStore";
import { loadEditCases, toolExpectation, type EditCase } from "./editCases";

export const MANUAL_EDIT_MARKER = "MY MANUAL EDIT";
// Slide 2 gets a manual text edit, slide 4 a manual layout edit.
export const MANUAL_EDIT_SLIDE_INDEX = 1;
export const MANUAL_LAYOUT_SLIDE_INDEX = 3;

// --- Decks -------------------------------------------------------------------

const EXTRA_SLIDES_FILE = path.join(
  import.meta.dirname,
  "..",
  "cases",
  "large-deck-extra-slides.json",
);

// The seed deck followed by 14 fixed extra slides (20 in total). The seed
// slides keep their ids and positions, so every case means the same thing
// on both decks.
export function largeDeck(): Deck {
  const extra = z
    .array(SlideContentSchema)
    .parse(JSON.parse(readFileSync(EXTRA_SLIDES_FILE, "utf8")));
  return {
    id: "large-deck",
    title: "Deck Lab (extended)",
    slides: [
      ...structuredClone(seedDeck.slides),
      ...extra.map((content, i) =>
        materializeSlide(content, `slide-${seedDeck.slides.length + i + 1}`),
      ),
    ],
  };
}

// --- Cases -------------------------------------------------------------------

export interface BaselineCase {
  testCase: EditCase;
  targetIndex: number;
}

// Single update_slide edits with no history or selection, so both
// approaches receive exactly the same information. Targets are seed slides,
// which sit at the same positions in the large deck.
export function baselineCases(): BaselineCase[] {
  return loadEditCases().flatMap((testCase) => {
    const expectation = toolExpectation(testCase);
    if (!expectation || testCase.history || testCase.selectedSlideId) return [];
    const { tools, optional, resultHasBlock } = expectation;
    if (tools.length !== 1 || optional || resultHasBlock) return [];
    const [call] = tools;
    if (call.tool !== "update_slide" || !call.slideId) return [];
    const targetIndex = seedDeck.slides.findIndex((s) => s.id === call.slideId);
    return targetIndex === -1 ? [] : [{ testCase, targetIndex }];
  });
}

// --- Manual edits ------------------------------------------------------------

function titleElement(slide: Slide | undefined) {
  const element = slide?.elements.find((el) => el.role === "title");
  if (!slide || !element || element.content.type !== "text") {
    throw new Error("Slide has no title element to edit");
  }
  return { slide, element, content: element.content };
}

// Simulates the user editing the deck by hand on the canvas before asking
// the AI for something else, through the same store actions the canvas
// uses:
// - text: MY MANUAL EDIT is appended to slide 2's title. Appended, not
//   replaced, so no text a case's message refers to disappears.
// - layout: slide 4's title is moved, resized and restyled.
export function withManualEdits(deck: Deck): Deck {
  const store = useDeckStore.getState();
  store.loadDeck(structuredClone(deck));

  const text = titleElement(
    useDeckStore.getState().deck.slides[MANUAL_EDIT_SLIDE_INDEX],
  );
  store.updateElement(text.slide.id, text.element.id, {
    ...text.content,
    text: `${text.content.text} (${MANUAL_EDIT_MARKER})`,
  });

  const layout = titleElement(
    useDeckStore.getState().deck.slides[MANUAL_LAYOUT_SLIDE_INDEX],
  );
  const { x, y, w, h } = layout.element.frame;
  store.setElementFrame(layout.slide.id, layout.element.id, {
    x: x + 80,
    y: y + 40,
    w: w - 240,
    h: h + 20,
  });
  store.updateElementStyle(layout.slide.id, layout.element.id, {
    italic: true,
    color: "#B91C1C",
  });

  return structuredClone(useDeckStore.getState().deck);
}

// --- Comparison --------------------------------------------------------------

// The content a slide shows, independent of ids and element positions, so a
// regenerated deck (new ids, re-laid out) can be compared with the original.
// The JSON round trip drops undefined-valued keys.
export function semanticSlides(deck: Deck): SlideContent[] {
  return deck.slides.map((slide) =>
    JSON.parse(JSON.stringify(getSlideContent(slide))),
  );
}

// Where and how a slide's elements are drawn (role, frame, style), without
// ids - what a manual move/resize/restyle changes.
export function slideLayout(slide: Slide | undefined): unknown {
  if (!slide) return undefined;
  return JSON.parse(
    JSON.stringify(
      slide.elements.map(({ role, frame, style }) => ({
        role,
        frame,
        style: style ?? {},
      })),
    ),
  );
}

// Every piece of visible text in the deck.
function deckTexts(deck: Deck): string[] {
  return semanticSlides(deck).flatMap((slide) => [
    slide.title,
    ...(slide.subtitle ? [slide.subtitle] : []),
    ...(slide.layout?.columnTitles ?? []),
    ...slide.body.flatMap((block) => {
      switch (block.type) {
        case "bullets":
          return block.items;
        case "paragraph":
          return [block.text];
        case "table":
          return [...block.headers, ...block.rows.flat()];
        case "chart":
          return block.data.map((d) => d.label);
        case "image":
          return [block.alt];
      }
    }),
  ]);
}

// Text present before an edit that no longer appears anywhere after it.
export function removedTexts(before: Deck, after: Deck): string[] {
  const remaining = deckTexts(after);
  return deckTexts(before).filter(
    (text) => !remaining.some((other) => other.includes(text)),
  );
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Whether a case's message mentions any of `texts` (ignoring case and
// punctuation) - e.g. a slide title the manual edit removed.
export function referencesAny(message: string, texts: string[]): string[] {
  const normalizedMessage = ` ${normalize(message)} `;
  return texts.filter((text) => {
    const needle = normalize(text);
    return needle.length > 0 && normalizedMessage.includes(` ${needle} `);
  });
}

// The deck in the exact shape deckJsonSchema asks the model to return
// (nullable instead of optional fields), so returning it unchanged is
// trivially possible for the baseline.
export function toDeckJson(deck: Deck) {
  return {
    title: deck.title,
    slides: semanticSlides(deck).map((slide) => ({
      type: slide.type,
      title: slide.title,
      subtitle: slide.subtitle ?? null,
      layout: slide.layout?.columnTitles
        ? { columnTitles: slide.layout.columnTitles }
        : null,
      body: slide.body.map((block) => {
        const { column, ...rest } = block;
        const out: Record<string, unknown> = {
          ...rest,
          column: column ?? null,
        };
        if (block.type === "chart" || block.type === "image") {
          out.caption = block.caption ?? null;
        }
        delete out.url; // never part of the generated shape
        return out;
      }),
    })),
  };
}

export interface EditComparison {
  slideCountChanged: boolean;
  nonTargetPreserved: boolean;
  targetChanged: boolean;
  manualEditSurvived: boolean;
  manualLayoutSurvived: boolean;
}

// Compares by slide position, the same way for both approaches: a single-
// slide edit should leave the deck's length and every other slide alone.
export function compareEdit(
  before: Deck,
  after: Deck,
  targetIndex: number,
): EditComparison {
  const was = semanticSlides(before);
  const now = semanticSlides(after);
  const slideCountChanged = was.length !== now.length;
  return {
    slideCountChanged,
    nonTargetPreserved:
      !slideCountChanged &&
      was.every(
        (slide, i) => i === targetIndex || isDeepStrictEqual(slide, now[i]),
      ),
    targetChanged:
      now[targetIndex] !== undefined &&
      !isDeepStrictEqual(was[targetIndex], now[targetIndex]),
    manualEditSurvived: JSON.stringify(
      now[MANUAL_EDIT_SLIDE_INDEX] ?? {},
    ).includes(MANUAL_EDIT_MARKER),
    manualLayoutSurvived: isDeepStrictEqual(
      slideLayout(before.slides[MANUAL_LAYOUT_SLIDE_INDEX]),
      slideLayout(after.slides[MANUAL_LAYOUT_SLIDE_INDEX]),
    ),
  };
}

// --- The baseline call -------------------------------------------------------

const BASELINE_SYSTEM_PROMPT = `You edit presentation decks. You receive the current deck as JSON and an instruction from the user. Apply the instruction and return the full updated deck in the same JSON format. Keep everything the instruction does not ask to change exactly as it is.`;

export interface BaselineResult {
  after?: Deck;
  usage?: TokenUsage;
  latencyMs: number;
  error?: string;
}

// The naive approach tool calling replaces: send the whole deck, get the
// whole deck back. Same model and same structured-output schema as the
// app's bulk generation.
export async function runFullDeckBaseline(
  deck: Deck,
  instruction: string,
): Promise<BaselineResult> {
  const start = performance.now();
  const elapsed = () => Math.round(performance.now() - start);
  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: BASELINE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Current deck:\n${JSON.stringify(toDeckJson(deck))}\n\nInstruction: ${instruction}`,
        },
      ],
      response_format: { type: "json_schema", json_schema: deckJsonSchema },
    });
    const latencyMs = elapsed();
    const usage = toTokenUsage(completion.usage);
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = GeneratedDeckSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return { usage, latencyMs, error: "response failed schema validation" };
    }
    return { after: normalizeGeneratedDeck(parsed.data), usage, latencyMs };
  } catch (error) {
    return {
      latencyMs: elapsed(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
