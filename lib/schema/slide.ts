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

export const ContentBlockSchema = z.discriminatedUnion("type", [
  BulletsBlockSchema,
  ParagraphBlockSchema,
  TableBlockSchema,
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
  speakerNotes: z.string().default(""),
});
export type Slide = z.infer<typeof SlideSchema>;

export const DeckSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  slides: z.array(SlideSchema),
});
export type Deck = z.infer<typeof DeckSchema>;
