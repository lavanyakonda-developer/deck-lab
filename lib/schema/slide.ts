import { z } from "zod";

export const SlideTypeSchema = z.enum([
  "title",
  "content",
  "two-column",
  "comparison",
  "table",
]);
export type SlideType = z.infer<typeof SlideTypeSchema>;

const columnField = {
  column: z.number().int().min(0).max(1).optional(),
};

export const BulletsBlockSchema = z.object({
  type: z.literal("bullets"),
  items: z.array(z.string().min(1)).min(1),
  ...columnField,
});

export const ParagraphBlockSchema = z.object({
  type: z.literal("paragraph"),
  text: z.string().min(1),
  ...columnField,
});

export const TableBlockSchema = z.object({
  type: z.literal("table"),
  headers: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())),
  ...columnField,
});

export const ChartTypeSchema = z.enum(["bar", "line", "pie"]);

export const ChartBlockSchema = z.object({
  type: z.literal("chart"),
  chartType: ChartTypeSchema,
  data: z
    .array(z.object({ label: z.string().min(1), value: z.number() }))
    .min(1),
  caption: z.string().optional(),
  ...columnField,
});

// url is nullable (not optional) because "not generated yet" / "generation
// failed" is real application state, not just an AI-protocol artifact -
// see lib/ai/generateImage.ts for the async generation flow that fills it in.
export const ImageBlockSchema = z.object({
  type: z.literal("image"),
  url: z.string().nullable(),
  alt: z.string().min(1),
  caption: z.string().optional(),
  ...columnField,
});

export const ContentBlockSchema = z.discriminatedUnion("type", [
  BulletsBlockSchema,
  ParagraphBlockSchema,
  TableBlockSchema,
  ChartBlockSchema,
  ImageBlockSchema,
]);
export type ContentBlock = z.infer<typeof ContentBlockSchema>;

export const LayoutHintsSchema = z.object({
  columnTitles: z.array(z.string()).max(2).optional(),
});
export type LayoutHints = z.infer<typeof LayoutHintsSchema>;

// ---------------------------------------------------------------------------
// Semantic slide content - what a slide SAYS, independent of where anything
// sits on it. This is the shape the AI generates and edits (OpenAI tool /
// structured-output schemas mirror it), and what the layout engine
// (lib/slides/layoutEngine.ts) turns into positioned elements. It is no
// longer how a slide is stored - see SlideSchema below.
// ---------------------------------------------------------------------------
export const SlideContentSchema = z.object({
  type: SlideTypeSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  body: z.array(ContentBlockSchema).default([]),
  layout: LayoutHintsSchema.optional(),
});
export type SlideContent = z.infer<typeof SlideContentSchema>;

// ---------------------------------------------------------------------------
// Element-based slide model (Google Slides-style). A slide is a list of
// independently positioned elements on a fixed 1920x1080 stage (scaled to
// fit at render time, mapped linearly to inches on export). `type` records
// which layout the slide was created from - a starting template, not a
// constraint on what the slide contains.
// ---------------------------------------------------------------------------
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

export const FrameSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});
export type Frame = z.infer<typeof FrameSchema>;

// Theme-relative colors (resolved against lib/themes tokens at render
// time) so switching theme still recolors every element.
export const TextToneSchema = z.enum(["foreground", "muted", "accent"]);

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const ElementStyleSchema = z.object({
  fontSize: z.number().positive().optional(),
  fontWeight: z.enum(["normal", "semibold", "bold"]).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  valign: z.enum(["top", "middle", "bottom"]).optional(),
  tone: TextToneSchema.optional(),
  uppercase: z.boolean().optional(),
  italic: z.boolean().optional(),
  // Explicit colors (hex) set by the user via the format toolbar. `color`
  // overrides `tone`; `fill` is a box/shape background. Unlike tones these
  // don't follow theme changes - same as picking a fixed color in Slides.
  color: HexColorSchema.optional(),
  fill: HexColorSchema.optional(),
});
export type ElementStyle = z.infer<typeof ElementStyleSchema>;

// A free text box (titles, subtitles, column headings). Empty text is
// valid - an empty box shows its placeholder in the editor.
export const TextContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

// A plain shape - the comparison layout's column cards, or one the user
// inserted.
export const ShapeKindSchema = z.enum(["rect", "ellipse"]);
export const ShapeContentSchema = z.object({
  type: z.literal("shape"),
  shape: ShapeKindSchema,
});

export const ElementContentSchema = z.discriminatedUnion("type", [
  TextContentSchema,
  ShapeContentSchema,
  BulletsBlockSchema,
  ParagraphBlockSchema,
  TableBlockSchema,
  ChartBlockSchema,
  ImageBlockSchema,
]);
export type ElementContent = z.infer<typeof ElementContentSchema>;

// What an element is FOR - lets the AI ("change the title"), the semantic
// projection (getSlideContent) and exports find the right element no
// matter where it has been moved. "body" holds content blocks; "textbox"
// is a free text box the user inserted; "decoration" carries no meaning
// (shapes, the comparison layout's "vs").
export const ElementRoleSchema = z.enum([
  "title",
  "subtitle",
  "column-title",
  "body",
  "textbox",
  "decoration",
]);
export type ElementRole = z.infer<typeof ElementRoleSchema>;

export const SlideElementSchema = z.object({
  id: z.string().min(1),
  role: ElementRoleSchema,
  frame: FrameSchema,
  style: ElementStyleSchema.optional(),
  content: ElementContentSchema,
});
export type SlideElement = z.infer<typeof SlideElementSchema>;

export const SlideSchema = z.object({
  id: z.string().min(1),
  type: SlideTypeSchema,
  // Required (no default) so a pre-element slide ({title, body, ...}) fails
  // validation loudly instead of passing with its content silently stripped.
  elements: z.array(SlideElementSchema),
});
export type Slide = z.infer<typeof SlideSchema>;

export const DeckSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  slides: z.array(SlideSchema),
});
export type Deck = z.infer<typeof DeckSchema>;
