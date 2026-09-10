import type { ContentBlock, LayoutHints } from "@/lib/schema/slide";

// Converts the "nullable instead of optional" shape OpenAI's strict mode
// requires (see deckGenerationSchema.ts / tools.ts) back into our
// canonical optional-field shape. Shared by normalizeGeneratedDeck.ts
// (Phase 3) and applyToolCalls.ts (Phase 4).

export function normalizeBlock(block: {
  type: string;
  column: number | null;
  caption?: string | null;
  [key: string]: unknown;
}): ContentBlock {
  const { column, caption, ...rest } = block;
  const normalized: Record<string, unknown> = {
    ...rest,
    column: column ?? undefined,
  };
  // caption only exists on chart/image blocks - leave it off entirely for
  // block types that never had the key, rather than adding a stray
  // `caption: undefined`.
  if (caption !== undefined) {
    normalized.caption = caption ?? undefined;
  }
  // The model never generates the actual image - it only describes it via
  // "alt". url starts null and is filled in later by generateImage.ts.
  if (block.type === "image") {
    normalized.url = null;
  }
  return normalized as ContentBlock;
}

type GeneratedLayout = {
  columnTitles: string[] | null;
} | null;

export function normalizeLayout(
  layout: GeneratedLayout,
): LayoutHints | undefined {
  if (!layout) return undefined;
  return {
    columnTitles: layout.columnTitles ?? undefined,
  };
}
