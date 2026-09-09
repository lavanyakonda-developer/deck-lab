"use client";

import type { SlideThemeTokens } from "@/lib/themes";
import type { ContentBlock, Slide } from "@/lib/schema/slide";
import { useDeckStore } from "@/store/deckStore";
import { InlineEditable } from "../InlineEditable";
import { EditableContentBlock } from "./EditableContentBlock";

export function ComparisonSlide({
  slide,
  theme,
}: {
  slide: Slide;
  theme: SlideThemeTokens;
}) {
  const updateSlide = useDeckStore((state) => state.updateSlide);

  const updateBlockAt = (index: number) => (next: ContentBlock) => {
    const body = slide.body.map((block, i) => (i === index ? next : block));
    updateSlide(slide.id, { body });
  };

  const indexed = slide.body.map((block, index) => ({ block, index }));
  const left = indexed.filter(({ block }) => (block.column ?? 0) === 0);
  const right = indexed.filter(({ block }) => (block.column ?? 0) === 1);
  const [leftTitle, rightTitle] = slide.layout?.columnTitles ?? [
    "Option A",
    "Option B",
  ];

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
      <div className="grid flex-1 grid-cols-[1fr_auto_1fr] gap-6">
        <div
          className="flex flex-col gap-3 rounded-lg border p-4"
          style={{ borderColor: theme.border }}
        >
          <h3
            className="text-sm font-semibold tracking-wide uppercase"
            style={{ color: theme.muted }}
          >
            {leftTitle}
          </h3>
          {left.map(({ block, index }) => (
            <EditableContentBlock
              key={index}
              block={block}
              theme={theme}
              onChange={updateBlockAt(index)}
            />
          ))}
        </div>
        <div
          className="flex items-center justify-center text-sm font-semibold"
          style={{ color: theme.muted }}
        >
          vs
        </div>
        <div
          className="flex flex-col gap-3 rounded-lg border p-4"
          style={{ borderColor: theme.border }}
        >
          <h3
            className="text-sm font-semibold tracking-wide uppercase"
            style={{ color: theme.muted }}
          >
            {rightTitle}
          </h3>
          {right.map(({ block, index }) => (
            <EditableContentBlock
              key={index}
              block={block}
              theme={theme}
              onChange={updateBlockAt(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
