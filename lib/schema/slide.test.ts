import { describe, expect, it } from "vitest";
import { DeckSchema, SlideSchema } from "./slide";

describe("SlideSchema", () => {
  it("accepts a minimal valid title slide and fills in defaults", () => {
    const result = SlideSchema.safeParse({
      id: "s1",
      type: "title",
      title: "Hello",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body).toEqual([]);
    }
  });

  it("accepts bullets, paragraph, and table body blocks", () => {
    const result = SlideSchema.safeParse({
      id: "s2",
      type: "content",
      title: "Body Content",
      body: [
        { type: "bullets", items: ["a", "b"] },
        { type: "paragraph", text: "hello" },
        { type: "table", headers: ["A", "B"], rows: [["1", "2"]] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown slide type", () => {
    const result = SlideSchema.safeParse({
      id: "s3",
      type: "not-a-real-type",
      title: "Bad",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a bullets block with zero items", () => {
    const result = SlideSchema.safeParse({
      id: "s4",
      type: "content",
      title: "Bad Bullets",
      body: [{ type: "bullets", items: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a chart block", () => {
    const result = SlideSchema.safeParse({
      id: "s7",
      type: "content",
      title: "Revenue",
      body: [
        {
          type: "chart",
          chartType: "bar",
          data: [
            { label: "Q1", value: 10 },
            { label: "Q2", value: 20 },
          ],
          caption: "Quarterly revenue",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a chart block with zero data points", () => {
    const result = SlideSchema.safeParse({
      id: "s8",
      type: "content",
      title: "Bad Chart",
      body: [{ type: "chart", chartType: "bar", data: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a chart block with an invalid chartType", () => {
    const result = SlideSchema.safeParse({
      id: "s9",
      type: "content",
      title: "Bad Chart",
      body: [
        {
          type: "chart",
          chartType: "pie3d",
          data: [{ label: "A", value: 1 }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts an image block with a null url (not yet generated)", () => {
    const result = SlideSchema.safeParse({
      id: "s10",
      type: "content",
      title: "Photo",
      body: [{ type: "image", url: null, alt: "A modern office" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an image block with a real url", () => {
    const result = SlideSchema.safeParse({
      id: "s11",
      type: "content",
      title: "Photo",
      body: [
        {
          type: "image",
          url: "data:image/png;base64,abc123",
          alt: "A modern office",
          caption: "Our new HQ",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an image block missing alt text", () => {
    const result = SlideSchema.safeParse({
      id: "s12",
      type: "content",
      title: "Photo",
      body: [{ type: "image", url: null, alt: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown content block type", () => {
    const result = SlideSchema.safeParse({
      id: "s5",
      type: "content",
      title: "Bad Block",
      body: [{ type: "video", url: "x" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a slide missing a title", () => {
    const result = SlideSchema.safeParse({
      id: "s6",
      type: "title",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a slide missing an id", () => {
    const result = SlideSchema.safeParse({
      type: "title",
      title: "No id",
    });
    expect(result.success).toBe(false);
  });
});

describe("DeckSchema", () => {
  it("accepts a deck with multiple valid slides", () => {
    const result = DeckSchema.safeParse({
      id: "d1",
      title: "My Deck",
      slides: [
        { id: "s1", type: "title", title: "Cover" },
        {
          id: "s2",
          type: "table",
          title: "Data",
          body: [{ type: "table", headers: ["A"], rows: [] }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a deck containing an invalid slide", () => {
    const result = DeckSchema.safeParse({
      id: "d2",
      title: "My Deck",
      slides: [{ id: "s1", type: "title" }],
    });
    expect(result.success).toBe(false);
  });
});
