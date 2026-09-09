import { describe, expect, it } from "vitest";
import { normalizeBlock, normalizeLayout } from "./normalize";

describe("normalizeBlock", () => {
  it("converts a null column to undefined", () => {
    const result = normalizeBlock({
      type: "bullets",
      items: ["a"],
      column: null,
    });
    expect(result).toEqual({
      type: "bullets",
      items: ["a"],
      column: undefined,
    });
  });

  it("preserves a real column value", () => {
    const result = normalizeBlock({ type: "paragraph", text: "hi", column: 1 });
    expect(result).toMatchObject({ column: 1 });
  });

  it("does not add a caption key to blocks that never had one", () => {
    const result = normalizeBlock({
      type: "table",
      headers: ["A"],
      rows: [],
      column: null,
    });
    expect(result).not.toHaveProperty("caption");
  });

  it("converts a chart block's null caption to undefined", () => {
    const result = normalizeBlock({
      type: "chart",
      chartType: "bar",
      data: [{ label: "Q1", value: 10 }],
      caption: null,
      column: null,
    });
    expect(result).toEqual({
      type: "chart",
      chartType: "bar",
      data: [{ label: "Q1", value: 10 }],
      caption: undefined,
      column: undefined,
    });
  });

  it("preserves a real chart caption", () => {
    const result = normalizeBlock({
      type: "chart",
      chartType: "line",
      data: [{ label: "Q1", value: 10 }],
      caption: "Growth",
      column: null,
    });
    expect(result).toMatchObject({ caption: "Growth" });
  });

  it("adds url: null to an image block (the model never generates one)", () => {
    const result = normalizeBlock({
      type: "image",
      alt: "A modern office",
      caption: null,
      column: null,
    });
    expect(result).toEqual({
      type: "image",
      alt: "A modern office",
      url: null,
      caption: undefined,
      column: undefined,
    });
  });
});

describe("normalizeLayout", () => {
  it("returns undefined for a null layout", () => {
    expect(normalizeLayout(null)).toBeUndefined();
  });

  it("converts every null field to undefined", () => {
    expect(
      normalizeLayout({
        align: null,
        columns: null,
        columnTitles: null,
        density: null,
      }),
    ).toEqual({
      align: undefined,
      columns: undefined,
      columnTitles: undefined,
      density: undefined,
    });
  });

  it("preserves real values", () => {
    expect(
      normalizeLayout({
        align: "left",
        columns: 2,
        columnTitles: ["A", "B"],
        density: "compact",
      }),
    ).toEqual({
      align: "left",
      columns: 2,
      columnTitles: ["A", "B"],
      density: "compact",
    });
  });
});
