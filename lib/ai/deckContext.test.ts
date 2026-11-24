import { describe, expect, it } from "vitest";
import type { Deck } from "@/lib/schema/slide";
import { materializeDeck } from "@/lib/slides/layoutEngine";
import { messageNamesSlide, serializeDeckContext } from "./deckContext";

const deck: Deck = materializeDeck({
  id: "deck-1",
  title: "Q3 Roadmap",
  slides: [
    {
      id: "slide-a",
      type: "title",
      title: "Q3 Roadmap",
      subtitle: "Looking ahead",
      body: [],
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
    },
    {
      id: "slide-c",
      type: "table",
      title: "Data",
      body: [{ type: "table", headers: ["A", "B"], rows: [["1", "2"]] }],
    },
  ],
});

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

  it("marks the currently selected slide so the model can resolve unqualified requests", () => {
    const context = serializeDeckContext(deck, "slide-b");
    const lines = context.split("\n");
    const selectedLine = lines.find((line) => line.includes("slide-b"));
    const otherLine = lines.find((line) => line.includes("slide-a"));
    expect(selectedLine).toContain("(currently selected/viewed by the user)");
    expect(otherLine).not.toContain("currently selected");
  });

  it("reads content from elements, not positions - a moved title is still found", () => {
    const moved = structuredClone(deck);
    const title = moved.slides[1].elements.find((el) => el.role === "title")!;
    title.frame = { x: 900, y: 900, w: 400, h: 80 };
    expect(serializeDeckContext(moved)).toContain('title="Objectives"');
    expect(serializeDeckContext(moved)).not.toContain("frame");
    expect(serializeDeckContext(moved)).not.toContain("900");
  });

  it("marks no slide as selected when selectedSlideId is omitted or null", () => {
    expect(serializeDeckContext(deck)).not.toContain("currently selected");
    expect(serializeDeckContext(deck, null)).not.toContain(
      "currently selected",
    );
  });
});

describe("messageNamesSlide", () => {
  it.each([
    "Change the title of slide 3 to X",
    "delete slide #2",
    "Make slides 2 and 3 shorter",
    "Shorten the 2nd slide",
    "Rewrite the third slide",
    "Remove the last slide",
    "Rename the 'objectives' slide to Goals",
    "Add a row to DATA",
  ])("detects a named slide in %j", (message) => {
    expect(messageNamesSlide(message, deck)).toBe(true);
  });

  it.each([
    "Change the title to 'Overview'",
    "Make this more concise",
    "Add a bullet about pricing",
    "Make it better",
    "Add 3 bullets about pricing",
  ])("finds no named slide in %j", (message) => {
    expect(messageNamesSlide(message, deck)).toBe(false);
  });
});
