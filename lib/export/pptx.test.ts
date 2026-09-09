// pptxgenjs's writeFile() branches on `typeof window` - undefined here (node
// environment) makes it write a real file via fs instead of trying a
// browser download, which is what lets this run as a normal Vitest test.
// @vitest-environment node
import { existsSync, statSync, unlinkSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import type { Deck } from "@/lib/schema/slide";
import { downloadDeckAsPptx } from "./pptx";

const outputPaths: string[] = [];

afterEach(() => {
  for (const path of outputPaths.splice(0)) {
    if (existsSync(path)) unlinkSync(path);
  }
});

function deckWith(overrides: Partial<Deck>, fileName: string): Deck {
  outputPaths.push(fileName);
  return {
    id: "deck-1",
    title: "Test Deck",
    slides: [],
    ...overrides,
  };
}

describe("downloadDeckAsPptx", () => {
  it("builds a slide for every slide type and block type without throwing", async () => {
    const deck = deckWith(
      {
        title: "Every Type",
        slides: [
          {
            id: "s1",
            type: "title",
            title: "Title Slide",
            subtitle: "A subtitle",
            body: [],
            speakerNotes: "",
          },
          {
            id: "s2",
            type: "content",
            title: "Mixed Content",
            body: [
              { type: "bullets", items: ["One", "Two"] },
              { type: "paragraph", text: "Some paragraph text." },
              {
                type: "table",
                headers: ["A", "B"],
                rows: [["1", "2"]],
              },
              {
                type: "chart",
                chartType: "line",
                data: [
                  { label: "Jan", value: 1 },
                  { label: "Feb", value: 2 },
                ],
                caption: "A chart caption",
              },
              { type: "image", url: null, alt: "Pending image" },
              {
                type: "image",
                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
                alt: "Generated image",
                caption: "An image caption",
              },
            ],
            speakerNotes: "",
          },
          {
            id: "s3",
            type: "two-column",
            title: "Two Column",
            body: [
              { type: "bullets", items: ["Left"], column: 0 },
              { type: "bullets", items: ["Right"], column: 1 },
            ],
            layout: { columnTitles: ["Left", "Right"] },
            speakerNotes: "",
          },
          {
            id: "s4",
            type: "comparison",
            title: "Comparison",
            body: [
              { type: "paragraph", text: "Option A", column: 0 },
              { type: "paragraph", text: "Option B", column: 1 },
            ],
            speakerNotes: "",
          },
          {
            id: "s5",
            type: "table",
            title: "Table Slide",
            body: [{ type: "table", headers: ["X"], rows: [["1"]] }],
            speakerNotes: "",
          },
        ],
      },
      "every-type.pptx",
    );

    await expect(downloadDeckAsPptx(deck)).resolves.toBeUndefined();
    expect(existsSync("every-type.pptx")).toBe(true);
    expect(statSync("every-type.pptx").size).toBeGreaterThan(1000);
  });

  it("derives the output file name from the deck title", async () => {
    const deck = deckWith(
      { title: "  Q3 Roadmap!! Review  ", slides: [] },
      "q3-roadmap-review.pptx",
    );

    await downloadDeckAsPptx(deck);

    expect(existsSync("q3-roadmap-review.pptx")).toBe(true);
  });

  it("falls back to a generic file name when the title has no usable characters", async () => {
    const deck = deckWith({ title: "!!!", slides: [] }, "deck.pptx");

    await downloadDeckAsPptx(deck);

    expect(existsSync("deck.pptx")).toBe(true);
  });
});
