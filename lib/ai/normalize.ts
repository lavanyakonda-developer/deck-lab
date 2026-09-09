import type { ContentBlock, LayoutHints } from "@/lib/schema/slide";

// Converts the "nullable instead of optional" shape OpenAI's strict mode
// requires (see deckGenerationSchema.ts / tools.ts) back into our
// canonical optional-field shape. Shared by normalizeGeneratedDeck.ts
// (Phase 3) and applyToolCalls.ts (Phase 4).

export function normalizeBlock(block: {
  column: number | null;
  [key: string]: unknown;
}): ContentBlock {
  const { column, ...rest } = block;
  return { ...rest, column: column ?? undefined } as ContentBlock;
}

type GeneratedLayout = {
  align: "left" | "center" | "right" | null;
  columns: number | null;
  columnTitles: string[] | null;
  density: "compact" | "comfortable" | "spacious" | null;
} | null;

export function normalizeLayout(
  layout: GeneratedLayout,
): LayoutHints | undefined {
  if (!layout) return undefined;
  return {
    align: layout.align ?? undefined,
    columns: layout.columns ?? undefined,
    columnTitles: layout.columnTitles ?? undefined,
    density: layout.density ?? undefined,
  };
}
