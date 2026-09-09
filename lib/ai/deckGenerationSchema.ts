import { z } from "zod";
import { SlideTypeSchema } from "@/lib/schema/slide";

// Mirrors lib/schema/slide.ts but every optional field is nullable instead
// of absent, matching what OpenAI's strict structured-output mode actually
// returns (every property present, null standing in for "not provided").

const columnField = {
  column: z.number().int().min(0).max(1).nullable(),
};

const BulletsBlockGenerated = z.object({
  type: z.literal("bullets"),
  items: z.array(z.string().min(1)).min(1),
  ...columnField,
});

const ParagraphBlockGenerated = z.object({
  type: z.literal("paragraph"),
  text: z.string().min(1),
  ...columnField,
});

const TableBlockGenerated = z.object({
  type: z.literal("table"),
  headers: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())),
  ...columnField,
});

export const ContentBlockGeneratedSchema = z.discriminatedUnion("type", [
  BulletsBlockGenerated,
  ParagraphBlockGenerated,
  TableBlockGenerated,
]);

export const LayoutHintsGeneratedSchema = z.object({
  align: z.enum(["left", "center", "right"]).nullable(),
  columns: z.number().int().min(1).max(2).nullable(),
  columnTitles: z.array(z.string()).max(2).nullable(),
  density: z.enum(["compact", "comfortable", "spacious"]).nullable(),
});

export const SlideGeneratedSchema = z.object({
  type: SlideTypeSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  body: z.array(ContentBlockGeneratedSchema),
  layout: LayoutHintsGeneratedSchema.nullable(),
  speakerNotes: z.string(),
});

export const GeneratedDeckSchema = z.object({
  title: z.string(),
  slides: z.array(SlideGeneratedSchema).min(1),
});
export type GeneratedDeck = z.infer<typeof GeneratedDeckSchema>;
