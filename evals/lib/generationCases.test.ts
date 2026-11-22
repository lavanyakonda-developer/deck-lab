import { describe, expect, it } from "vitest";
import type { Deck, Slide } from "@/lib/schema/slide";
import { materializeSlide } from "@/lib/slides/layoutEngine";
import { estimateCostUsd, priceFor } from "../pricing";
import {
  loadGenerationCases,
  scoreGenerationRun,
  type GenerationCase,
} from "./generationCases";
import type { SSEResult, TimedEvent } from "./sse";

const slides: Slide[] = [
  materializeSlide({ type: "title", title: "Intro", body: [] }, "s1"),
  materializeSlide(
    {
      type: "content",
      title: "Numbers",
      body: [
        {
          type: "chart",
          chartType: "bar",
          data: [{ label: "A", value: 1 }],
        },
      ],
    },
    "s2",
  ),
  materializeSlide(
    {
      type: "content",
      title: "Picture",
      body: [{ type: "image", url: null, alt: "x" }],
    },
    "s3",
  ),
];
const deck: Deck = { id: "d", title: "Deck", slides };
const usage = {
  total: { promptTokens: 1000, completionTokens: 2000, totalTokens: 3000 },
};

function stream(...events: Array<[string, unknown, number]>): SSEResult {
  const timed: TimedEvent[] = events.map(([event, data, t]) => ({
    event,
    data,
    t,
  }));
  return { status: 200, events: timed, totalMs: timed.at(-1)?.t ?? 0 };
}

const asksForThree: GenerationCase = {
  id: "c",
  prompt: "p",
  expectedSlides: 3,
};

describe("scoreGenerationRun", () => {
  it("scores a complete streamed deck", () => {
    const score = scoreGenerationRun(
      asksForThree,
      stream(
        ["slide", slides[0], 400],
        ["slide", slides[1], 900],
        ["slide", slides[2], 1300],
        ["done", { deck, usage }, 1350],
      ),
    );
    expect(score).toMatchObject({
      success: true,
      slideCount: 3,
      slideCountMatch: true,
      hasChart: true,
      hasTable: false,
      hasImage: true,
      streamConsistent: true,
      streamedSlides: 3,
      firstSlideMs: 400,
      doneMs: 1350,
      usage: usage.total,
    });
  });

  it("flags a wrong slide count, and leaves it unset when none was asked", () => {
    const result = stream(["done", { deck }, 100]);
    expect(
      scoreGenerationRun({ ...asksForThree, expectedSlides: 5 }, result)
        .slideCountMatch,
    ).toBe(false);
    expect(
      scoreGenerationRun({ id: "c", prompt: "p" }, result).slideCountMatch,
    ).toBeUndefined();
  });

  it("flags streamed slides that differ from the final deck", () => {
    const score = scoreGenerationRun(
      asksForThree,
      stream(["slide", slides[0], 100], ["done", { deck }, 200]),
    );
    expect(score.success).toBe(true);
    expect(score.streamConsistent).toBe(false);
  });

  it("fails on an error event, an HTTP error or a missing deck", () => {
    expect(
      scoreGenerationRun(
        asksForThree,
        stream(["slide", slides[0], 100], ["error", { error: "boom" }, 200]),
      ),
    ).toMatchObject({ success: false, error: "boom", streamedSlides: 1 });
    expect(
      scoreGenerationRun(asksForThree, {
        status: 400,
        events: [],
        totalMs: 5,
        httpError: "bad prompt",
      }),
    ).toMatchObject({ success: false, error: "HTTP 400: bad prompt" });
    expect(scoreGenerationRun(asksForThree, stream()).error).toBe(
      "stream ended without a deck",
    );
  });
});

describe("pricing", () => {
  it("computes cost from per-million prices", () => {
    expect(
      estimateCostUsd(
        "m",
        { promptTokens: 1_000_000, completionTokens: 500_000, totalTokens: 0 },
        { m: { input: 2, output: 8 } },
      ),
    ).toBeCloseTo(6);
  });

  it("matches dated snapshots to the longest model prefix", () => {
    const prices = {
      "gpt-4o": { input: 1, output: 1 },
      "gpt-4o-mini": { input: 2, output: 2 },
    };
    expect(priceFor("gpt-4o-2024-08-06", prices)?.input).toBe(1);
    expect(priceFor("gpt-4o-mini-2024-07-18", prices)?.input).toBe(2);
    expect(priceFor("unknown-model", prices)).toBeUndefined();
  });
});

describe("generation-prompts.json", () => {
  it("has about 20 prompts, most with a stated slide count", () => {
    const cases = loadGenerationCases();
    expect(cases.length).toBeGreaterThanOrEqual(20);
    const withCount = cases.filter((c) => c.expectedSlides !== undefined);
    expect(withCount.length).toBeGreaterThan(cases.length / 2);
  });
});
