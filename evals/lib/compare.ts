import { isDeepStrictEqual } from "node:util";
import type { Deck, Slide } from "@/lib/schema/slide";

export function slidesEqual(a: Slide, b: Slide): boolean {
  return isDeepStrictEqual(a, b);
}

// Ids of slides that were not supposed to change but did: every slide in
// `before` that isn't a target must still exist in `after`, deep-equal.
// Matched by id, so a slide that only moved position still counts as
// preserved (position changes are judged separately, per case).
export function changedNonTargetSlides(
  before: Deck,
  after: Deck,
  targetIds: Iterable<string>,
): string[] {
  const targets = new Set(targetIds);
  const afterById = new Map(after.slides.map((slide) => [slide.id, slide]));
  return before.slides
    .filter((slide) => !targets.has(slide.id))
    .filter((slide) => {
      const match = afterById.get(slide.id);
      return !match || !slidesEqual(slide, match);
    })
    .map((slide) => slide.id);
}
