"use client";

import type { SlideThemeTokens } from "@/lib/themes";
import type { Slide } from "@/lib/schema/slide";
import { useDeckStore } from "@/store/deckStore";
import { InlineEditable } from "../InlineEditable";
import { EditableContentBlock } from "./EditableContentBlock";

export function TableSlide({
  slide,
  theme,
}: {
  slide: Slide;
  theme: SlideThemeTokens;
}) {
  const updateSlide = useDeckStore((state) => state.updateSlide);
  const tableIndex = slide.body.findIndex((block) => block.type === "table");
  const tableBlock = tableIndex === -1 ? undefined : slide.body[tableIndex];

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
      <div className="flex-1 overflow-auto">
        {tableBlock ? (
          <EditableContentBlock
            block={tableBlock}
            theme={theme}
            onChange={(next) => {
              const body = slide.body.map((b, i) =>
                i === tableIndex ? next : b,
              );
              updateSlide(slide.id, { body });
            }}
          />
        ) : (
          <p className="text-sm" style={{ color: theme.muted }}>
            No table content yet.
          </p>
        )}
      </div>
    </div>
  );
}
