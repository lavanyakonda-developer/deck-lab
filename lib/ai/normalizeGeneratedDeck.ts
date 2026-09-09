import { createId } from "@/lib/id";
import type { ContentBlock, Deck, Slide } from "@/lib/schema/slide";
import type { GeneratedDeck } from "./deckGenerationSchema";

export function normalizeGeneratedDeck(generated: GeneratedDeck): Deck {
  return {
    id: createId("deck"),
    title: generated.title,
    slides: generated.slides.map((slide): Slide => ({
      id: createId("slide"),
      type: slide.type,
      title: slide.title,
      subtitle: slide.subtitle ?? undefined,
      body: slide.body.map((block): ContentBlock => ({
        ...block,
        column: block.column ?? undefined,
      })),
      layout: slide.layout
        ? {
            align: slide.layout.align ?? undefined,
            columns: slide.layout.columns ?? undefined,
            columnTitles: slide.layout.columnTitles ?? undefined,
            density: slide.layout.density ?? undefined,
          }
        : undefined,
      speakerNotes: slide.speakerNotes,
    })),
  };
}
