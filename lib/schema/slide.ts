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
export type ChartType = z.infer<typeof ChartTypeSchema>;

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
  align: z.enum(["left", "center", "right"]).optional(),
  columns: z.number().int().min(1).max(2).optional(),
  columnTitles: z.array(z.string()).max(2).optional(),
  density: z.enum(["compact", "comfortable", "spacious"]).optional(),
});
export type LayoutHints = z.infer<typeof LayoutHintsSchema>;

export const SlideSchema = z.object({
  id: z.string().min(1),
  type: SlideTypeSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  body: z.array(ContentBlockSchema).default([]),
  layout: LayoutHintsSchema.optional(),
});
export type Slide = z.infer<typeof SlideSchema>;

export const DeckSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  slides: z.array(SlideSchema),
});
export type Deck = z.infer<typeof DeckSchema>;
