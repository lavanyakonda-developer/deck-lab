"use client";

import type { Slide } from "@/lib/schema/slide";
import { useDeckStore } from "@/store/deckStore";
import { InlineEditable } from "../InlineEditable";
import { EditableContentBlock } from "./EditableContentBlock";

export function ContentSlide({ slide }: { slide: Slide }) {
  const updateSlide = useDeckStore((state) => state.updateSlide);

  return (
    <div className="flex h-full flex-col gap-6 px-12 py-10">
      <InlineEditable
        value={slide.title}
        onCommit={(next) => updateSlide(slide.id, { title: next })}
        placeholder="Slide title"
        ariaLabel="Slide title"
        className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50"
      />
      <div className="flex flex-1 flex-col justify-center gap-4">
        {slide.body.map((block, i) => (
          <EditableContentBlock
            key={i}
            block={block}
            onChange={(next) => {
              const body = slide.body.map((b, idx) => (idx === i ? next : b));
              updateSlide(slide.id, { body });
            }}
          />
        ))}
      </div>
    </div>
  );
}
