import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();
vi.mock("@/lib/ai/openaiClient", () => ({
  getOpenAIClient: () => ({ chat: { completions: { create: mockCreate } } }),
  OPENAI_MODEL: "gpt-4o",
}));

import { seedDeck } from "@/lib/seedDeck";
import { getSlideTitle } from "@/lib/slides/layoutEngine";
import {
  compareEdit,
  MANUAL_EDIT_MARKER,
  runFullDeckBaseline,
  toDeckJson,
  withManualEdit,
} from "./baseline";

function respondWith(deckJson: unknown) {
  mockCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(deckJson) } }],
    usage: { prompt_tokens: 900, completion_tokens: 800, total_tokens: 1700 },
  });
}

describe("withManualEdit", () => {
  it("changes only slide 2's title, without mutating the input", () => {
    const before = structuredClone(seedDeck);
    const edited = withManualEdit(seedDeck);
    expect(getSlideTitle(edited.slides[1])).toBe(MANUAL_EDIT_MARKER);
    expect(seedDeck).toEqual(before);
    expect(edited.slides.filter((_, i) => i !== 1)).toEqual(
      seedDeck.slides.filter((_, i) => i !== 1),
    );
  });
});

describe("runFullDeckBaseline", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("scores an unchanged echo of the deck as fully preserved (no conversion noise)", async () => {
    const before = withManualEdit(seedDeck);
    respondWith(toDeckJson(before));

    const result = await runFullDeckBaseline(before, "anything");

    expect(result.error).toBeUndefined();
    expect(result.usage).toEqual({
      promptTokens: 900,
      completionTokens: 800,
      totalTokens: 1700,
    });
    expect(compareEdit(before, result.after!, 2)).toEqual({
      slideCountChanged: false,
      nonTargetPreserved: true,
      targetChanged: false,
      manualEditSurvived: true,
    });
  });

  it("sends the full deck JSON and uses the deck schema", async () => {
    respondWith(toDeckJson(seedDeck));
    await runFullDeckBaseline(seedDeck, "Make slide 3 shorter");
    const request = mockCreate.mock.calls[0][0];
    expect(request.response_format.type).toBe("json_schema");
    expect(request.messages[1].content).toContain("Why A Schema Matters");
    expect(request.messages[1].content).toContain("Make slide 3 shorter");
  });

  it("reports a reverted manual edit and collateral changes", async () => {
    const before = withManualEdit(seedDeck);
    const json = toDeckJson(before);
    json.slides[1].title = "What This Deck Demonstrates"; // manual edit lost
    json.slides[2].title = "Schemas Are Contracts"; // the requested change
    respondWith(json);

    const result = await runFullDeckBaseline(before, "Retitle slide 3");

    expect(compareEdit(before, result.after!, 2)).toEqual({
      slideCountChanged: false,
      nonTargetPreserved: false,
      targetChanged: true,
      manualEditSurvived: false,
    });
  });

  it("returns an error instead of throwing when the call fails", async () => {
    mockCreate.mockRejectedValue(new Error("rate limited"));
    const result = await runFullDeckBaseline(seedDeck, "x");
    expect(result.error).toBe("rate limited");
    expect(result.after).toBeUndefined();
  });
});

describe("compareEdit", () => {
  it("flags a changed slide count", () => {
    const shorter = { ...seedDeck, slides: seedDeck.slides.slice(0, 5) };
    expect(compareEdit(seedDeck, shorter, 2)).toMatchObject({
      slideCountChanged: true,
      nonTargetPreserved: false,
    });
  });
});
