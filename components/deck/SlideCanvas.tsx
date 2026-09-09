"use client";

import { useDeckStore } from "@/store/deckStore";
import { SlideRenderer } from "./SlideRenderer";

export function SlideCanvas() {
  const slides = useDeckStore((state) => state.deck.slides);
  const selectedSlideId = useDeckStore((state) => state.selectedSlideId);
  const selectedSlide =
    slides.find((slide) => slide.id === selectedSlideId) ?? slides[0] ?? null;

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto bg-zinc-100 p-6 dark:bg-zinc-900">
      <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {selectedSlide ? (
          <SlideRenderer slide={selectedSlide} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-600">
              No slides yet. Generate a deck or add a blank slide to get
              started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
