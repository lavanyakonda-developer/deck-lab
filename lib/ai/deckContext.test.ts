import { describe, expect, it } from "vitest";
import type { Deck } from "@/lib/schema/slide";
import { serializeDeckContext } from "./deckContext";

const deck: Deck = {
  id: "deck-1",
  title: "Q3 Roadmap",
  slides: [
    {
      id: "slide-a",
      type: "title",
      title: "Q3 Roadmap",
      subtitle: "Looking ahead",
      body: [],
      speakerNotes: "",
    },
    {
      id: "slide-b",
      type: "content",
      title: "Objectives",
      body: [
        { type: "bullets", items: ["Grow revenue", "Ship v2"] },
        {
          type: "paragraph",
          text: "A".repeat(200),
        },
      ],
      speakerNotes: "internal notes should not need to appear",
    },
    {
      id: "slide-c",
      type: "table",
      title: "Data",
      body: [{ type: "table", headers: ["A", "B"], rows: [["1", "2"]] }],
      speakerNotes: "",
    },
  ],
};

describe("serializeDeckContext", () => {
  it("includes every slide's real id so the model can reference it", () => {
    const context = serializeDeckContext(deck);
    expect(context).toContain('id="slide-a"');
    expect(context).toContain('id="slide-b"');
    expect(context).toContain('id="slide-c"');
  });

  it("includes titles, types, and a content summary", () => {
    const context = serializeDeckContext(deck);
    expect(context).toContain("type=title");
    expect(context).toContain('title="Objectives"');
    expect(context).toContain("bullets: Grow revenue | Ship v2");
    expect(context).toContain("table: headers [A, B], 1 row(s)");
  });

  it("truncates long paragraphs", () => {
    const context = serializeDeckContext(deck);
    expect(context).toContain("…");
    expect(context).not.toContain("A".repeat(200));
  });

  it("excludes speaker notes to keep the context compact", () => {
    const context = serializeDeckContext(deck);
    expect(context).not.toContain("internal notes");
  });
});
