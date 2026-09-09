"use client";

import type { Slide } from "@/lib/schema/slide";
import { useDeckStore } from "@/store/deckStore";
import { InlineEditable } from "../InlineEditable";
import { EditableContentBlock } from "./EditableContentBlock";

export function TableSlide({ slide }: { slide: Slide }) {
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
        className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50"
      />
      <div className="flex-1 overflow-auto">
        {tableBlock ? (
          <EditableContentBlock
            block={tableBlock}
            onChange={(next) => {
              const body = slide.body.map((b, i) =>
                i === tableIndex ? next : b,
              );
              updateSlide(slide.id, { body });
            }}
          />
        ) : (
          <p className="text-sm text-zinc-400 dark:text-zinc-600">
            No table content yet.
          </p>
        )}
      </div>
    </div>
  );
}
