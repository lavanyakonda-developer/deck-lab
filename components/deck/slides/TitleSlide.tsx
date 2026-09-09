"use client";

import type { Slide } from "@/lib/schema/slide";
import { useDeckStore } from "@/store/deckStore";
import { InlineEditable } from "../InlineEditable";

export function TitleSlide({ slide }: { slide: Slide }) {
  const updateSlide = useDeckStore((state) => state.updateSlide);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-12 text-center">
      <InlineEditable
        value={slide.title}
        onCommit={(next) => updateSlide(slide.id, { title: next })}
        placeholder="Slide title"
        ariaLabel="Slide title"
        className="text-4xl font-bold text-zinc-900 dark:text-zinc-50"
      />
      <InlineEditable
        value={slide.subtitle ?? ""}
        onCommit={(next) =>
          updateSlide(slide.id, { subtitle: next || undefined })
        }
        placeholder="Subtitle (optional)"
        ariaLabel="Slide subtitle"
        className="max-w-2xl text-lg text-zinc-500 dark:text-zinc-400"
      />
    </div>
  );
}
