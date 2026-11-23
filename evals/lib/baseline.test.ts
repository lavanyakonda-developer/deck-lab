import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();
vi.mock("@/lib/ai/openaiClient", () => ({
  getOpenAIClient: () => ({ chat: { completions: { create: mockCreate } } }),
  OPENAI_MODEL: "gpt-4o",
}));

import { seedDeck } from "@/lib/seedDeck";
import type { Deck } from "@/lib/schema/slide";
import { getSlideTitle } from "@/lib/slides/layoutEngine";
import { useDeckStore } from "@/store/deckStore";
import {
  baselineCases,
  compareEdit,
  largeDeck,
  MANUAL_EDIT_MARKER,
  referencesAny,
  removedTexts,
  runFullDeckBaseline,
  semanticSlides,
  slideLayout,
  toDeckJson,
  withManualEdits,
} from "./baseline";

function respondWith(deckJson: unknown) {
  mockCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(deckJson) } }],
    usage: { prompt_tokens: 900, completion_tokens: 800, total_tokens: 1700 },
  });
}

describe("withManualEdits", () => {
  it("appends the marker to slide 2's title and restyles slide 4's title, nothing else", () => {
    const original = structuredClone(seedDeck);
    const edited = withManualEdits(seedDeck);

    expect(seedDeck).toEqual(original);
    expect(getSlideTitle(edited.slides[1])).toBe(
      `What This Deck Demonstrates (${MANUAL_EDIT_MARKER})`,
    );
    const title = (deck: Deck) =>
      deck.slides[3].elements.find((el) => el.role === "title")!;
    expect(title(edited).frame).not.toEqual(title(seedDeck).frame);
    expect(title(edited).style).toMatchObject({
      italic: true,
      color: "#B91C1C",
    });
    for (const i of [0, 2, 4, 5]) {
      expect(edited.slides[i]).toEqual(seedDeck.slides[i]);
    }
  });
});

describe("baseline cases vs. the manual edits", () => {
  const decks = { seed: seedDeck, large: largeDeck() };

  it.each(Object.entries(decks))(
    "no case refers to text the manual edits removed (%s deck)",
    (_, deck) => {
      const removed = removedTexts(deck, withManualEdits(deck));
      for (const { testCase } of baselineCases()) {
        expect(referencesAny(testCase.message, removed), testCase.id).toEqual(
          [],
        );
      }
    },
  );

  it("would catch a manual edit that replaces a title a case refers to", () => {
    useDeckStore.getState().loadDeck(structuredClone(seedDeck));
    const slide = useDeckStore.getState().deck.slides[1];
    const title = slide.elements.find((el) => el.role === "title")!;
    useDeckStore.getState().updateElement(slide.id, title.id, {
      type: "text",
      text: MANUAL_EDIT_MARKER,
    });
    const removed = removedTexts(seedDeck, useDeckStore.getState().deck);
    const flagged = baselineCases().filter(
      ({ testCase }) => referencesAny(testCase.message, removed).length > 0,
    );
    expect(flagged.map((c) => c.testCase.id)).toEqual(["title-remove-bullet"]);
  });

  it("uses 12 single-slide cases", () => {
    expect(baselineCases()).toHaveLength(12);
  });
});

describe("largeDeck", () => {
  it("is the seed deck plus 14 slides, with unique ids and titles", () => {
    const deck = largeDeck();
    expect(deck.slides).toHaveLength(20);
    expect(deck.slides.slice(0, 6)).toEqual(seedDeck.slides);
    expect(new Set(deck.slides.map((s) => s.id)).size).toBe(20);
    expect(new Set(deck.slides.map(getSlideTitle)).size).toBe(20);
  });

  it("adds no slide a baseline case could be referring to", () => {
    const extraTitles = largeDeck().slides.slice(6).map(getSlideTitle);
    for (const { testCase } of baselineCases()) {
      expect(referencesAny(testCase.message, extraTitles), testCase.id).toEqual(
        [],
      );
    }
  });
});

describe("compareEdit", () => {
  it("counts an untouched deck as fully preserved, layout included", () => {
    const before = withManualEdits(seedDeck);
    expect(compareEdit(before, structuredClone(before), 2)).toEqual({
      slideCountChanged: false,
      nonTargetPreserved: true,
      targetChanged: false,
      manualEditSurvived: true,
      manualLayoutSurvived: true,
    });
  });

  it("flags a changed slide count", () => {
    const shorter = { ...seedDeck, slides: seedDeck.slides.slice(0, 5) };
    expect(compareEdit(seedDeck, shorter, 2)).toMatchObject({
      slideCountChanged: true,
      nonTargetPreserved: false,
    });
  });

  it("detects a moved element even when the text is identical", () => {
    const before = withManualEdits(seedDeck);
    const after = structuredClone(before);
    after.slides[3].elements[0].frame.x += 1;
    expect(slideLayout(after.slides[3])).not.toEqual(
      slideLayout(before.slides[3]),
    );
    expect(compareEdit(before, after, 2).manualLayoutSurvived).toBe(false);
  });
});

describe("runFullDeckBaseline", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("keeps the text of an unchanged echo but loses the manual layout by construction", async () => {
    const before = withManualEdits(seedDeck);
    respondWith(toDeckJson(before));

    const result = await runFullDeckBaseline(before, "anything");

    expect(result.error).toBeUndefined();
    expect(result.usage).toEqual({
      promptTokens: 900,
      completionTokens: 800,
      totalTokens: 1700,
    });
    expect(semanticSlides(result.after!)).toEqual(semanticSlides(before));
    expect(compareEdit(before, result.after!, 2)).toEqual({
      slideCountChanged: false,
      nonTargetPreserved: true,
      targetChanged: false,
      manualEditSurvived: true,
      manualLayoutSurvived: false,
    });
  });

  it("round-trips the large deck's text exactly", async () => {
    const before = withManualEdits(largeDeck());
    respondWith(toDeckJson(before));
    const result = await runFullDeckBaseline(before, "anything");
    expect(semanticSlides(result.after!)).toEqual(semanticSlides(before));
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
    const before = withManualEdits(seedDeck);
    const json = toDeckJson(before);
    json.slides[1].title = "What This Deck Demonstrates"; // manual edit lost
    json.slides[2].title = "Schemas Are Contracts"; // the requested change
    respondWith(json);

    const result = await runFullDeckBaseline(before, "Retitle slide 3");

    expect(compareEdit(before, result.after!, 2)).toMatchObject({
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
