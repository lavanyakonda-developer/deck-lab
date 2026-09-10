import { describe, expect, it } from "vitest";
import { DeckSchema } from "@/lib/schema/slide";
import type { GeneratedDeck } from "./deckGenerationSchema";
import { normalizeGeneratedDeck } from "./normalizeGeneratedDeck";

describe("normalizeGeneratedDeck", () => {
  it("converts nulls to undefined, assigns ids, and produces a schema-valid deck", () => {
    const generated: GeneratedDeck = {
      title: "Test Deck",
      slides: [
        {
          type: "title",
          title: "Welcome",
          subtitle: null,
          body: [],
          layout: null,
        },
        {
          type: "two-column",
          title: "Details",
          subtitle: null,
          body: [{ type: "bullets", items: ["a", "b"], column: 0 }],
          layout: {
            columnTitles: ["Left", "Right"],
          },
        },
      ],
    };

    const deck = normalizeGeneratedDeck(generated);

    expect(deck.id).toBeTruthy();
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides[0].id).toBeTruthy();
    expect(deck.slides[1].id).toBeTruthy();
    expect(deck.slides[0].id).not.toBe(deck.slides[1].id);
    expect(deck.slides[0].subtitle).toBeUndefined();
    expect(deck.slides[1].body[0]).toMatchObject({
      type: "bullets",
      items: ["a", "b"],
      column: 0,
    });
    expect(deck.slides[1].layout).toEqual({ columnTitles: ["Left", "Right"] });

    const validation = DeckSchema.safeParse(deck);
    expect(validation.success).toBe(true);
  });

  it("converts a null layout to undefined", () => {
    const generated: GeneratedDeck = {
      title: "Test Deck",
      slides: [
        {
          type: "content",
          title: "X",
          subtitle: null,
          body: [],
          layout: null,
        },
      ],
    };

    const deck = normalizeGeneratedDeck(generated);
    expect(deck.slides[0].layout).toBeUndefined();
  });
});
