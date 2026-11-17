import { createId } from "@/lib/id";
import {
  STAGE_HEIGHT,
  STAGE_WIDTH,
  type ElementContent,
  type ElementRole,
  type ElementStyle,
  type Frame,
  type SlideElement,
} from "@/lib/schema/slide";

// Builds new standalone elements for the editor's Insert toolbar.

export type InsertKind =
  | "text"
  | "bullets"
  | "paragraph"
  | "table"
  | "chart"
  | "image"
  | "rect"
  | "ellipse";

const DEFAULT_SIZES: Record<InsertKind, { w: number; h: number }> = {
  text: { w: 700, h: 120 },
  bullets: { w: 800, h: 260 },
  paragraph: { w: 800, h: 200 },
  table: { w: 900, h: 320 },
  chart: { w: 900, h: 520 },
  image: { w: 800, h: 450 },
  rect: { w: 400, h: 260 },
  ellipse: { w: 320, h: 320 },
};

function defaultContent(kind: InsertKind): ElementContent {
  switch (kind) {
    case "text":
      return { type: "text", text: "" };
    case "bullets":
      return { type: "bullets", items: ["New bullet point"] };
    case "paragraph":
      return { type: "paragraph", text: "New paragraph" };
    case "table":
      return {
        type: "table",
        headers: ["Column 1", "Column 2", "Column 3"],
        rows: [
          ["", "", ""],
          ["", "", ""],
        ],
      };
    case "chart":
      return {
        type: "chart",
        chartType: "bar",
        data: [
          { label: "A", value: 3 },
          { label: "B", value: 5 },
          { label: "C", value: 2 },
        ],
      };
    case "image":
      return { type: "image", url: null, alt: "Image" };
    case "rect":
    case "ellipse":
      return { type: "shape", shape: kind };
  }
}

function roleFor(content: ElementContent): ElementRole {
  if (content.type === "text") return "textbox";
  if (content.type === "shape") return "decoration";
  return "body";
}

function defaultStyle(content: ElementContent): ElementStyle | undefined {
  if (content.type === "shape") return undefined;
  return { fontSize: 34, tone: "foreground" };
}

// Centered at its default size, nudged so repeated inserts don't stack
// exactly on top of each other.
export function centeredFrame(kind: InsertKind, offset = 0): Frame {
  const { w, h } = DEFAULT_SIZES[kind];
  return {
    x: (STAGE_WIDTH - w) / 2 + offset,
    y: (STAGE_HEIGHT - h) / 2 + offset,
    w,
    h,
  };
}

export function createElement(
  content: ElementContent,
  frame: Frame,
  style?: ElementStyle,
): SlideElement {
  const merged = stripUndefined({ ...defaultStyle(content), ...style });
  return {
    id: createId("el"),
    role: roleFor(content),
    frame,
    ...(Object.keys(merged).length > 0 ? { style: merged } : {}),
    content,
  };
}

export function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}

export function createDefaultElement(
  kind: InsertKind,
  offset = 0,
): SlideElement {
  return createElement(defaultContent(kind), centeredFrame(kind, offset));
}

// Fits an image's natural aspect ratio inside a box, centered on the stage.
export function imageFrame(
  naturalWidth: number,
  naturalHeight: number,
  maxW = 900,
  maxH = 600,
): Frame {
  const ratio = naturalWidth / naturalHeight || 1;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  return { x: (STAGE_WIDTH - w) / 2, y: (STAGE_HEIGHT - h) / 2, w, h };
}
