import { createId } from "@/lib/id";
import type { Deck, Slide } from "@/lib/schema/slide";
import type { GeneratedDeck } from "./deckGenerationSchema";
import { normalizeBlock, normalizeLayout } from "./normalize";

export function normalizeGeneratedDeck(generated: GeneratedDeck): Deck {
  return {
    id: createId("deck"),
    title: generated.title,
    slides: generated.slides.map((slide): Slide => ({
      id: createId("slide"),
      type: slide.type,
      title: slide.title,
      subtitle: slide.subtitle ?? undefined,
      body: slide.body.map(normalizeBlock),
      layout: normalizeLayout(slide.layout),
    })),
  };
}
