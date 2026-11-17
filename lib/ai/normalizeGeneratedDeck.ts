import { createId } from "@/lib/id";
import type { Deck } from "@/lib/schema/slide";
import { materializeSlide } from "@/lib/slides/layoutEngine";
import type { GeneratedDeck } from "./deckGenerationSchema";
import { normalizeBlock, normalizeLayout } from "./normalize";

// The model generates semantic content only (no ids, no positions); this
// assigns ids and lays each slide out into positioned elements.
export function normalizeGeneratedDeck(generated: GeneratedDeck): Deck {
  return {
    id: createId("deck"),
    title: generated.title,
    slides: generated.slides.map((slide) =>
      materializeSlide({
        type: slide.type,
        title: slide.title,
        subtitle: slide.subtitle ?? undefined,
        body: slide.body.map(normalizeBlock),
        layout: normalizeLayout(slide.layout),
      }),
    ),
  };
}
