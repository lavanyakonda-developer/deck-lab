import { describe, expect, it } from "vitest";
import { SlideElementSchema } from "@/lib/schema/slide";
import {
  createDefaultElement,
  createElement,
  imageFrame,
  type InsertKind,
} from "./elementFactory";

const KINDS: InsertKind[] = [
  "text",
  "bullets",
  "paragraph",
  "table",
  "chart",
  "image",
  "rect",
  "ellipse",
];

describe("createDefaultElement", () => {
  it.each(KINDS)("creates a schema-valid %s element", (kind) => {
    expect(
      SlideElementSchema.safeParse(createDefaultElement(kind)).success,
    ).toBe(true);
  });

  it("gives text boxes the textbox role and shapes the decoration role", () => {
    expect(createDefaultElement("text").role).toBe("textbox");
    expect(createDefaultElement("rect").role).toBe("decoration");
    expect(createDefaultElement("chart").role).toBe("body");
  });

  it("offsets repeated inserts", () => {
    expect(createDefaultElement("text", 24).frame.x).toBe(
      createDefaultElement("text").frame.x + 24,
    );
  });
});

describe("createElement", () => {
  it("merges an explicit style over the defaults, dropping undefined fields", () => {
    const element = createElement(
      { type: "text", text: "hi" },
      { x: 0, y: 0, w: 100, h: 50 },
      { fill: "#ffeeaa", italic: undefined },
    );
    expect(element.style).toEqual({
      fontSize: 34,
      tone: "foreground",
      fill: "#ffeeaa",
    });
  });
});

describe("imageFrame", () => {
  it("keeps the image's aspect ratio within the max box", () => {
    const wide = imageFrame(1600, 400);
    expect(wide.w / wide.h).toBeCloseTo(4);
    const tall = imageFrame(400, 1600);
    expect(tall.h).toBe(600);
    expect(tall.w / tall.h).toBeCloseTo(0.25);
  });
});
