"use client";

import type { ContentBlock, Slide } from "@/lib/schema/slide";
import { useDeckStore } from "@/store/deckStore";
import { InlineEditable } from "../InlineEditable";
import { EditableContentBlock } from "./EditableContentBlock";

export function TwoColumnSlide({ slide }: { slide: Slide }) {
  const updateSlide = useDeckStore((state) => state.updateSlide);

  const updateBlockAt = (index: number) => (next: ContentBlock) => {
    const body = slide.body.map((block, i) => (i === index ? next : block));
    updateSlide(slide.id, { body });
  };

  const indexed = slide.body.map((block, index) => ({ block, index }));
  const left = indexed.filter(({ block }) => (block.column ?? 0) === 0);
  const right = indexed.filter(({ block }) => (block.column ?? 0) === 1);
  const [leftTitle, rightTitle] = slide.layout?.columnTitles ?? [];

  return (
    <div className="flex h-full flex-col gap-6 px-12 py-10">
      <InlineEditable
        value={slide.title}
        onCommit={(next) => updateSlide(slide.id, { title: next })}
        placeholder="Slide title"
        ariaLabel="Slide title"
        className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50"
      />
      <div className="grid flex-1 grid-cols-2 gap-8">
        <div className="flex flex-col gap-3">
          {leftTitle && (
            <h3 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
              {leftTitle}
            </h3>
          )}
          {left.map(({ block, index }) => (
            <EditableContentBlock
              key={index}
              block={block}
              onChange={updateBlockAt(index)}
            />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {rightTitle && (
            <h3 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
              {rightTitle}
            </h3>
          )}
          {right.map(({ block, index }) => (
            <EditableContentBlock
              key={index}
              block={block}
              onChange={updateBlockAt(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
