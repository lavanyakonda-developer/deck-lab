import { describe, expect, it } from "vitest";
import { GeneratedDeckSchema } from "./deckGenerationSchema";

describe("GeneratedDeckSchema", () => {
  it("accepts a well-formed generated deck with nulls in place of optional fields", () => {
    const result = GeneratedDeckSchema.safeParse({
      title: "Q3 Roadmap",
      slides: [
        {
          type: "title",
          title: "Q3 Roadmap",
          subtitle: "A look ahead",
          body: [],
          layout: null,
        },
        {
          type: "two-column",
          title: "Compare",
          subtitle: null,
          body: [
            { type: "bullets", items: ["a", "b"], column: 0 },
            { type: "paragraph", text: "hello", column: 1 },
          ],
          layout: {
            columnTitles: ["Left", "Right"],
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a slide with an unknown type", () => {
    const result = GeneratedDeckSchema.safeParse({
      title: "Bad Deck",
      slides: [
        {
          type: "banner",
          title: "X",
          subtitle: null,
          body: [],
          layout: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty slides array", () => {
    const result = GeneratedDeckSchema.safeParse({
      title: "Empty",
      slides: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a bullets block with zero items", () => {
    const result = GeneratedDeckSchema.safeParse({
      title: "Bad Bullets",
      slides: [
        {
          type: "content",
          title: "X",
          subtitle: null,
          body: [{ type: "bullets", items: [], column: null }],
          layout: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a chart block with a nullable caption", () => {
    const result = GeneratedDeckSchema.safeParse({
      title: "Revenue",
      slides: [
        {
          type: "content",
          title: "Revenue",
          subtitle: null,
          body: [
            {
              type: "chart",
              chartType: "bar",
              data: [
                { label: "Q1", value: 10 },
                { label: "Q2", value: 20 },
              ],
              caption: null,
              column: null,
            },
          ],
          layout: null,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a chart block with zero data points", () => {
    const result = GeneratedDeckSchema.safeParse({
      title: "Bad Chart",
      slides: [
        {
          type: "content",
          title: "X",
          subtitle: null,
          body: [
            {
              type: "chart",
              chartType: "pie",
              data: [],
              caption: null,
              column: null,
            },
          ],
          layout: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts an image block (no url field - the model never generates one)", () => {
    const result = GeneratedDeckSchema.safeParse({
      title: "Photo Deck",
      slides: [
        {
          type: "content",
          title: "Photo",
          subtitle: null,
          body: [
            {
              type: "image",
              alt: "A modern office",
              caption: null,
              column: null,
            },
          ],
          layout: null,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an image block with empty alt text", () => {
    const result = GeneratedDeckSchema.safeParse({
      title: "Photo Deck",
      slides: [
        {
          type: "content",
          title: "Photo",
          subtitle: null,
          body: [{ type: "image", alt: "", caption: null, column: null }],
          layout: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
