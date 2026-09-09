"use client";

import type { SlideThemeTokens } from "@/lib/themes";
import type { Slide } from "@/lib/schema/slide";
import { useDeckStore } from "@/store/deckStore";
import { InlineEditable } from "../InlineEditable";
import { EditableContentBlock } from "./EditableContentBlock";

export function ContentSlide({
  slide,
  theme,
}: {
  slide: Slide;
  theme: SlideThemeTokens;
}) {
  const updateSlide = useDeckStore((state) => state.updateSlide);

  return (
    <div className="flex h-full flex-col gap-6 px-12 py-10">
      <InlineEditable
        value={slide.title}
        onCommit={(next) => updateSlide(slide.id, { title: next })}
        placeholder="Slide title"
        ariaLabel="Slide title"
        className="text-2xl font-semibold"
        style={{ color: theme.foreground }}
      />
      <div className="flex flex-1 flex-col gap-4">
        {slide.body.map((block, i) => (
          <EditableContentBlock
            key={i}
            block={block}
            theme={theme}
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
