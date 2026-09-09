"use client";

import { createBlankSlide } from "@/lib/blankSlide";
import { useDeckStore } from "@/store/deckStore";

export function ThumbnailRail() {
  const slides = useDeckStore((state) => state.deck.slides);
  const selectedSlideId = useDeckStore((state) => state.selectedSlideId);
  const selectSlide = useDeckStore((state) => state.selectSlide);
  const addSlide = useDeckStore((state) => state.addSlide);

  return (
    <div className="flex h-24 w-full shrink-0 items-center gap-3 overflow-x-auto border-t border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
      {slides.length === 0 ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          Slide thumbnails will appear here.
        </p>
      ) : (
        slides.map((slide, index) => {
          const isSelected = slide.id === selectedSlideId;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => selectSlide(slide.id)}
              aria-current={isSelected}
              className={`flex h-16 w-28 shrink-0 flex-col justify-between rounded-md border px-2 py-1.5 text-left transition-colors ${
                isSelected
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-50 dark:bg-zinc-900"
                  : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
              }`}
            >
              <span className="text-[10px] font-medium text-zinc-400">
                {index + 1}
              </span>
              <span className="truncate text-xs text-zinc-700 dark:text-zinc-300">
                {slide.title || "Untitled"}
              </span>
            </button>
          );
        })
      )}
      <button
        type="button"
        onClick={() => addSlide(createBlankSlide())}
        aria-label="Add blank slide"
        className="flex h-16 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-zinc-300 text-zinc-400 transition-colors hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-700 dark:text-zinc-600 dark:hover:border-zinc-600 dark:hover:text-zinc-400"
      >
        <span className="text-xl leading-none">+</span>
      </button>
    </div>
  );
}
