import {
  STAGE_WIDTH,
  type ContentBlock,
  type Frame,
  type SlideElement,
} from "@/lib/schema/slide";
import type { SlideThemeTokens } from "@/lib/themes";

// Shared by the PDF and PPTX exporters: maps an element's stage frame and
// style to page units, so both exports place everything exactly where it
// sits on the canvas (WYSIWYG), from the same numbers.

// 16:9 widescreen, in inches.
export const SLIDE_W = 13.33;
export const SLIDE_H = 7.5;

const INCHES_PER_UNIT = SLIDE_W / STAGE_WIDTH;
// 13.33in = 960pt across 1920 stage units.
const POINTS_PER_UNIT = (SLIDE_W * 72) / STAGE_WIDTH;
const DEFAULT_FONT_SIZE = 34;

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function toRegion(frame: Frame): Region {
  return {
    x: frame.x * INCHES_PER_UNIT,
    y: frame.y * INCHES_PER_UNIT,
    w: frame.w * INCHES_PER_UNIT,
    h: frame.h * INCHES_PER_UNIT,
  };
}

export interface ResolvedTextStyle {
  fontSize: number; // points
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  valign: "top" | "middle" | "bottom";
  color: string; // "#rrggbb"
  fill?: string; // "#rrggbb"
  uppercase: boolean;
}

// Same resolution rules as the canvas (SlideElementView): an explicit
// color wins over the theme tone.
export function resolveTextStyle(
  element: SlideElement,
  theme: SlideThemeTokens,
): ResolvedTextStyle {
  const style = element.style ?? {};
  return {
    fontSize: (style.fontSize ?? DEFAULT_FONT_SIZE) * POINTS_PER_UNIT,
    bold: style.fontWeight === "bold" || style.fontWeight === "semibold",
    italic: style.italic === true,
    align: style.align ?? "left",
    valign: style.valign ?? "top",
    color: style.color ?? theme[style.tone ?? "foreground"],
    fill: style.fill,
    uppercase: style.uppercase === true,
  };
}

export function isContentBlock(
  content: SlideElement["content"],
): content is ContentBlock {
  return content.type !== "text" && content.type !== "shape";
}
