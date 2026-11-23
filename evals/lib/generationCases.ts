import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { UsageReport, TokenUsage } from "@/lib/ai/usage";
import type { Deck, Slide, SlideContent } from "@/lib/schema/slide";
import { getSlideContent } from "@/lib/slides/layoutEngine";
import { eventsOfType, firstEventTime, type SSEResult } from "./sse";

// --- Case file format ------------------------------------------------------

const GenerationCaseSchema = z.object({
  id: z.string(),
  prompt: z.string().min(1),
  // The slide count the prompt asks for, if it asks for one. Stated
  // explicitly rather than parsed from the prompt so phrasings like "five
  // slides" or "a 6-slide deck" don't need a parser.
  expectedSlides: z.number().int().min(1).optional(),
});
export type GenerationCase = z.infer<typeof GenerationCaseSchema>;

const CASES_FILE = path.join(
  import.meta.dirname,
  "..",
  "cases",
  "generation-prompts.json",
);

export function loadGenerationCases(file = CASES_FILE): GenerationCase[] {
  const cases = z
    .array(GenerationCaseSchema)
    .parse(JSON.parse(readFileSync(file, "utf8")));
  const ids = new Set<string>();
  for (const c of cases) {
    if (ids.has(c.id)) throw new Error(`Duplicate generation case id: ${c.id}`);
    ids.add(c.id);
  }
  return cases;
}

// --- Scoring ---------------------------------------------------------------

export interface GenerationRunScore {
  caseId: string;
  success: boolean;
  error?: string;
  slideCount?: number;
  // Only set when the case asks for a specific count.
  slideCountMatch?: boolean;
  hasChart: boolean;
  hasTable: boolean;
  hasImage: boolean;
  // The deck follows the structure the generation prompt requires (see
  // structureProblems); empty when it does.
  structureProblems: string[];
  // What each slide shows, kept in the raw results for later review.
  slides?: SlideContent[];
  // The slides streamed one by one are exactly the final deck's slides
  // (same ids, same order) - the client relies on this to reconcile.
  streamConsistent: boolean;
  streamedSlides: number;
  firstSlideMs?: number;
  doneMs?: number;
  usage?: TokenUsage;
}

function blockCount(slide: Slide, type: "chart" | "table" | "image"): number {
  return slide.elements.filter((el) => el.content.type === type).length;
}

function hasBlock(deck: Deck, type: "chart" | "table" | "image"): boolean {
  return deck.slides.some((slide) => blockCount(slide, type) > 0);
}

// The structure lib/ai/generateDeck.ts requires of every generated deck:
// a title slide first, exactly one chart block and exactly one image block
// on two different slides, neither of them the first or the last slide
// (the last slide is the closing slide). That implies at least 4 slides.
export function structureProblems(deck: Deck): string[] {
  const problems: string[] = [];
  const last = deck.slides.length - 1;
  if (deck.slides[0]?.type !== "title") {
    problems.push("first slide is not a title slide");
  }
  for (const type of ["chart", "image"] as const) {
    const total = deck.slides.reduce((n, s) => n + blockCount(s, type), 0);
    if (total !== 1) problems.push(`${total} ${type} blocks (expected 1)`);
    deck.slides.forEach((slide, i) => {
      if (blockCount(slide, type) > 0 && (i === 0 || i === last)) {
        problems.push(`${type} on the ${i === 0 ? "first" : "last"} slide`);
      }
    });
  }
  const sharedSlide = deck.slides.findIndex(
    (s) => blockCount(s, "chart") > 0 && blockCount(s, "image") > 0,
  );
  if (sharedSlide !== -1) {
    problems.push(`chart and image on the same slide (${sharedSlide + 1})`);
  }
  if (deck.slides.length < 4) {
    problems.push(`${deck.slides.length} slides (the structure needs 4)`);
  }
  return problems;
}

export function scoreGenerationRun(
  testCase: GenerationCase,
  result: SSEResult,
): GenerationRunScore {
  const streamed = eventsOfType<Slide>(result.events, "slide");
  const done = eventsOfType<{ deck?: Deck; usage?: UsageReport }>(
    result.events,
    "done",
  )[0];
  const deck = done?.deck;
  const error =
    eventsOfType<{ error: string }>(result.events, "error")[0]?.error ??
    (result.httpError
      ? `HTTP ${result.status}: ${result.httpError}`
      : undefined) ??
    (deck ? undefined : "stream ended without a deck");

  const base = {
    caseId: testCase.id,
    streamedSlides: streamed.length,
    firstSlideMs: firstEventTime(result.events, "slide"),
    doneMs: firstEventTime(result.events, "done"),
    usage: done?.usage?.total,
  };

  if (error || !deck || deck.slides.length === 0) {
    return {
      ...base,
      success: false,
      error: error ?? "deck has no slides",
      hasChart: false,
      hasTable: false,
      hasImage: false,
      structureProblems: [],
      streamConsistent: false,
    };
  }

  return {
    ...base,
    success: true,
    slideCount: deck.slides.length,
    slideCountMatch:
      testCase.expectedSlides === undefined
        ? undefined
        : deck.slides.length === testCase.expectedSlides,
    hasChart: hasBlock(deck, "chart"),
    hasTable: hasBlock(deck, "table"),
    hasImage: hasBlock(deck, "image"),
    structureProblems: structureProblems(deck),
    slides: deck.slides.map((slide) => getSlideContent(slide)),
    streamConsistent:
      streamed.length === deck.slides.length &&
      streamed.every((slide, i) => slide.id === deck.slides[i].id),
  };
}
