import "./memoryStorage";
import { isDeepStrictEqual } from "node:util";
import { GeneratedDeckSchema } from "@/lib/ai/deckGenerationSchema";
import { deckJsonSchema } from "@/lib/ai/deckJsonSchema";
import { normalizeGeneratedDeck } from "@/lib/ai/normalizeGeneratedDeck";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/ai/openaiClient";
import { toTokenUsage, type TokenUsage } from "@/lib/ai/usage";
import type { Deck, SlideContent } from "@/lib/schema/slide";
import { getSlideContent } from "@/lib/slides/layoutEngine";
import { useDeckStore } from "@/store/deckStore";

export const MANUAL_EDIT_MARKER = "MY MANUAL EDIT";
export const MANUAL_EDIT_SLIDE_INDEX = 1; // slide 2

// Simulates the user editing slide 2 by hand on the canvas before asking the
// AI for something else: its first text element (the title) is replaced
// through the same store action the canvas uses.
export function withManualEdit(deck: Deck): Deck {
  const store = useDeckStore.getState();
  store.loadDeck(structuredClone(deck));
  const slide = useDeckStore.getState().deck.slides[MANUAL_EDIT_SLIDE_INDEX];
  const element = slide?.elements.find((el) => el.content.type === "text");
  if (!slide || !element || element.content.type !== "text") {
    throw new Error("Slide 2 has no text element to edit");
  }
  store.updateElement(slide.id, element.id, {
    ...element.content,
    text: MANUAL_EDIT_MARKER,
  });
  return structuredClone(useDeckStore.getState().deck);
}

// The content a slide shows, independent of ids and element positions, so a
// regenerated deck (new ids, re-laid out) can be compared with the original.
// The JSON round trip drops undefined-valued keys.
export function semanticSlides(deck: Deck): SlideContent[] {
  return deck.slides.map((slide) =>
    JSON.parse(JSON.stringify(getSlideContent(slide))),
  );
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
  };
}

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
