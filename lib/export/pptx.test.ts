// pptxgenjs's writeFile() branches on `typeof window` - undefined here (node
// environment) makes it write a real file via fs instead of trying a
// browser download, which is what lets this run as a normal Vitest test.
// @vitest-environment node
import { existsSync, readFileSync, statSync, unlinkSync } from "node:fs";
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import { SLIDE_THEME_NAMES, SLIDE_THEMES } from "@/lib/themes";
import type { Deck, SlideContent } from "@/lib/schema/slide";
import { materializeDeck } from "@/lib/slides/layoutEngine";
import { downloadDeckAsPptx } from "./pptx";

const outputPaths: string[] = [];

afterEach(() => {
  for (const path of outputPaths.splice(0)) {
    if (existsSync(path)) unlinkSync(path);
  }
});

// Slides are written as semantic content and laid out into elements, the
// same way the app builds them.
function deckWith(
  overrides: { title?: string; slides?: (SlideContent & { id: string })[] },
  fileName: string,
): Deck {
  outputPaths.push(fileName);
  return materializeDeck({
    id: "deck-1",
    title: overrides.title ?? "Test Deck",
    slides: overrides.slides ?? [],
  });
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
          },
          {
            id: "s4",
            type: "comparison",
            title: "Comparison",
            body: [
              { type: "paragraph", text: "Option A", column: 0 },
              { type: "paragraph", text: "Option B", column: 1 },
            ],
          },
          {
            id: "s5",
            type: "table",
            title: "Table Slide",
            body: [{ type: "table", headers: ["X"], rows: [["1"]] }],
          },
        ],
      },
      "every-type.pptx",
    );

    await expect(
      downloadDeckAsPptx(deck, SLIDE_THEMES.light),
    ).resolves.toBeUndefined();
    expect(existsSync("every-type.pptx")).toBe(true);
    expect(statSync("every-type.pptx").size).toBeGreaterThan(1000);
  });

  it("derives the output file name from the deck title", async () => {
    const deck = deckWith(
      { title: "  Q3 Roadmap!! Review  ", slides: [] },
      "q3-roadmap-review.pptx",
    );

    await downloadDeckAsPptx(deck, SLIDE_THEMES.light);

    expect(existsSync("q3-roadmap-review.pptx")).toBe(true);
  });

  it("falls back to a generic file name when the title has no usable characters", async () => {
    const deck = deckWith({ title: "!!!", slides: [] }, "deck.pptx");

    await downloadDeckAsPptx(deck, SLIDE_THEMES.light);

    expect(existsSync("deck.pptx")).toBe(true);
  });

  it("carries the selected theme's colors into the exported file", async () => {
    const deck = deckWith(
      {
        title: "Themed Deck",
        slides: [
          {
            id: "s1",
            type: "title",
            title: "Dark Theme Title",
            body: [],
          },
        ],
      },
      "themed-deck.pptx",
    );

    await downloadDeckAsPptx(deck, SLIDE_THEMES.dark);

    const zip = await JSZip.loadAsync(readFileSync("themed-deck.pptx"));
    const slideXml = await zip.file("ppt/slides/slide1.xml")!.async("text");

    // pptxgenjs writes hex colors without a leading "#" and uppercased.
    expect(slideXml).toContain(
      SLIDE_THEMES.dark.background.replace("#", "").toUpperCase(),
    );
    expect(slideXml).toContain(
      SLIDE_THEMES.dark.foreground.replace("#", "").toUpperCase(),
    );
  });

  it.each(SLIDE_THEME_NAMES)(
    "writes the %s theme's background and text colors",
    async (name) => {
      const theme = SLIDE_THEMES[name];
      const fileName = `theme-${name}.pptx`;
      const deck = deckWith(
        {
          title: `Theme ${name}`,
          slides: [{ id: "s1", type: "title", title: "Hello", body: [] }],
        },
        fileName,
      );

      await downloadDeckAsPptx(deck, theme);

      const zip = await JSZip.loadAsync(readFileSync(fileName));
      const slideXml = await zip.file("ppt/slides/slide1.xml")!.async("text");
      expect(slideXml).toContain(
        theme.background.replace("#", "").toUpperCase(),
      );
      expect(slideXml).toContain(
        theme.foreground.replace("#", "").toUpperCase(),
      );
    },
  );

  it("places each element at its canvas position (stage units -> EMU)", async () => {
    const deck = deckWith(
      {
        title: "Positions",
        slides: [{ id: "s1", type: "title", title: "Hi", body: [] }],
      },
      "positions.pptx",
    );
    const title = deck.slides[0].elements.find((el) => el.role === "title")!;
    title.frame = { x: 960, y: 540, w: 400, h: 100 };

    await downloadDeckAsPptx(deck, SLIDE_THEMES.light);

    const zip = await JSZip.loadAsync(readFileSync("positions.pptx"));
    const xml = await zip.file("ppt/slides/slide1.xml")!.async("text");
    const expectedX = Math.round(((960 * 13.33) / 1920) * 914400);
    const offsets = [...xml.matchAll(/<a:off x="(\d+)" y="(\d+)"/g)].map((m) =>
      Number(m[1]),
    );
    expect(offsets.some((x) => Math.abs(x - expectedX) <= 2)).toBe(true);
  });

  it("exports explicit formatting, shapes and inserted text boxes", async () => {
    const deck = deckWith(
      {
        title: "Styled",
        slides: [{ id: "s1", type: "content", title: "T", body: [] }],
      },
      "styled.pptx",
    );
    deck.slides[0].elements.push(
      {
        id: "box",
        role: "textbox",
        frame: { x: 100, y: 600, w: 600, h: 100 },
        style: {
          fontSize: 40,
          fontWeight: "bold",
          color: "#ab1234",
          fill: "#fef3c7",
        },
        content: { type: "text", text: "Callout" },
      },
      {
        id: "circle",
        role: "decoration",
        frame: { x: 1200, y: 600, w: 200, h: 200 },
        content: { type: "shape", shape: "ellipse" },
      },
    );

    await downloadDeckAsPptx(deck, SLIDE_THEMES.light);

    const zip = await JSZip.loadAsync(readFileSync("styled.pptx"));
    const xml = await zip.file("ppt/slides/slide1.xml")!.async("text");
    expect(xml).toContain("Callout");
    expect(xml).toContain("AB1234");
    expect(xml).toContain("FEF3C7");
    expect(xml).toContain('prst="ellipse"');
  });
});
