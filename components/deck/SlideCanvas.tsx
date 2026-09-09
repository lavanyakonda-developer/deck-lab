"use client";

import { getSlideTheme } from "@/lib/themes";
import { useDeckStore } from "@/store/deckStore";
import { SlideRenderer } from "./SlideRenderer";

export function SlideCanvas() {
  const slides = useDeckStore((state) => state.deck.slides);
  const selectedSlideId = useDeckStore((state) => state.selectedSlideId);
  const slideTheme = useDeckStore((state) => state.slideTheme);
  const theme = getSlideTheme(slideTheme);
  const selectedSlide =
    slides.find((slide) => slide.id === selectedSlideId) ?? slides[0] ?? null;

  return (
    <div className="flex min-w-0 flex-1 items-center justify-center overflow-auto bg-zinc-100 p-8 dark:bg-zinc-900">
      <div
        className="aspect-video w-full max-w-4xl overflow-hidden rounded-xl border shadow-sm"
        style={{ background: theme.background, borderColor: theme.border }}
      >
        {selectedSlide ? (
          <SlideRenderer slide={selectedSlide} theme={theme} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm" style={{ color: theme.muted }}>
              No slides yet. Generate a deck or add a blank slide to get
              started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
