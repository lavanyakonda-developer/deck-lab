import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { UsageReport, TokenUsage } from "@/lib/ai/usage";
import type { Deck, Slide } from "@/lib/schema/slide";
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
  // The slides streamed one by one are exactly the final deck's slides
  // (same ids, same order) - the client relies on this to reconcile.
  streamConsistent: boolean;
  streamedSlides: number;
  firstSlideMs?: number;
  doneMs?: number;
  usage?: TokenUsage;
}

function hasBlock(deck: Deck, type: "chart" | "table" | "image"): boolean {
  return deck.slides.some((slide) =>
    slide.elements.some((el) => el.content.type === type),
  );
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
    streamConsistent:
      streamed.length === deck.slides.length &&
      streamed.every((slide, i) => slide.id === deck.slides[i].id),
  };
}
