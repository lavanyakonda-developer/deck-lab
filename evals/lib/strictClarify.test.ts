import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/openaiClient", () => ({
  getOpenAIClient: () => {
    throw new Error("tests must pass a judge");
  },
  OPENAI_MODEL: "gpt-4o",
}));

import { seedDeck } from "@/lib/seedDeck";
import type { EditCase, EditRunScore } from "./editCases";
import { namesSlide, scoreStrictClarify } from "./strictClarify";

const withSelection: EditCase = {
  id: "selected-change-title",
  category: "ambiguous-with-selection",
  message: "Change the title to 'Overview'",
  selectedSlideId: "slide-3",
  expect: { clarify: true },
};
const noSelection: EditCase = {
  id: "ambiguous-change-title",
  category: "ambiguous-no-selection",
  message: "Change the title to 'Overview'",
  expect: { clarify: true },
};

function score(reply: string, calls: string[] = []): EditRunScore {
  return {
    caseId: "x",
    category: "x",
    kind: "clarify",
    calls,
    invalidCalls: [],
    reply,
    latencyMs: 1,
    passed: true,
    problems: [],
  };
}

describe("namesSlide", () => {
  it("matches the number exactly and the title ignoring case and punctuation", () => {
    expect(
      namesSlide(
        'Update slide 3 ("why a schema matters")?',
        3,
        "Why A Schema Matters",
      ),
    ).toEqual({
      number: true,
      title: true,
    });
    expect(
      namesSlide("Update slide 30?", 3, "Why A Schema Matters").number,
    ).toBe(false);
  });
});

describe("scoreStrictClarify with a selected slide (rule)", () => {
  const judge = vi.fn();

  it("passes when the reply names the slide's number and title", async () => {
    const result = await scoreStrictClarify(
      withSelection,
      score(
        'Update slide 3 ("Why A Schema Matters") - set the title to "Overview"?',
      ),
      seedDeck,
      judge,
    );
    expect(result).toEqual({
      correct: true,
      method: "rule",
      reason: "names the selected slide",
    });
    expect(judge).not.toHaveBeenCalled();
  });

  it("fails when the title or number is missing", async () => {
    const result = await scoreStrictClarify(
      withSelection,
      score("Which slide should I change?"),
      seedDeck,
      judge,
    );
    expect(result).toMatchObject({
      correct: false,
      reason: 'does not name slide 3 or "Why A Schema Matters"',
    });
  });

  it("fails when a tool call was made", async () => {
    const result = await scoreStrictClarify(
      withSelection,
      score('slide 3 ("Why A Schema Matters")?', ["update_slide(slide-3)"]),
      seedDeck,
      judge,
    );
    expect(result).toMatchObject({
      correct: false,
      reason: "made a tool call",
    });
  });
});

describe("scoreStrictClarify without a selected slide (judge)", () => {
  it("uses the judge's verdict and keeps it", async () => {
    const verdict = {
      model: "gpt-4o-mini",
      pass: false,
      reason: "Assumes slide 1.",
      usage: { promptTokens: 200, completionTokens: 12, totalTokens: 212 },
    };
    const judge = vi.fn().mockResolvedValue(verdict);
    const reply = 'To confirm, update slide 1 ("Deck Lab") to "Overview"?';

    const result = await scoreStrictClarify(
      noSelection,
      score(reply),
      seedDeck,
      judge,
    );

    expect(judge).toHaveBeenCalledWith(noSelection.message, reply);
    expect(result).toEqual({
      correct: false,
      method: "judge",
      reason: "Assumes slide 1.",
      judge: verdict,
    });
  });

  it("counts a judge error as not correct, with the error as the reason", async () => {
    const judge = vi
      .fn()
      .mockResolvedValue({ model: "gpt-4o-mini", error: "rate limited" });
    const result = await scoreStrictClarify(
      noSelection,
      score("Which slide?"),
      seedDeck,
      judge,
    );
    expect(result).toMatchObject({
      correct: false,
      reason: "judge error: rate limited",
    });
  });

  it("doesn't call the judge when a tool call was made", async () => {
    const judge = vi.fn();
    const result = await scoreStrictClarify(
      noSelection,
      score("Done.", ["update_slide(slide-1)"]),
      seedDeck,
      judge,
    );
    expect(result.correct).toBe(false);
    expect(judge).not.toHaveBeenCalled();
  });
});
