"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SlideThemeTokens } from "@/lib/themes";
import type { Slide } from "@/lib/schema/slide";

interface SlideThumbnailProps {
  slide: Slide;
  index: number;
  theme: SlideThemeTokens;
  isSelected: boolean;
  elementId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export const SlideThumbnail = memo(function SlideThumbnail({
  slide,
  index,
  theme,
  isSelected,
  elementId,
  onSelect,
  onDelete,
}: SlideThumbnailProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: theme.background,
    borderColor: isSelected ? theme.accent : theme.border,
    borderWidth: isSelected ? 2 : 1,
  };

  return (
    <div
      id={elementId}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(slide.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(slide.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-current={isSelected}
      className={`group relative flex h-16 w-28 shrink-0 cursor-grab flex-col justify-between rounded-lg border px-2.5 py-2 text-left transition-colors active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(slide.id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`Delete slide ${index + 1}`}
        className="absolute top-1 right-1 hidden h-4 w-4 items-center justify-center rounded-full bg-zinc-900/80 text-[10px] leading-none text-white hover:bg-zinc-900 group-hover:flex dark:bg-zinc-50/80 dark:text-zinc-900 dark:hover:bg-zinc-50"
      >
        ×
      </button>
      <span className="text-[10px] font-medium" style={{ color: theme.muted }}>
        {index + 1}
      </span>
      <span className="truncate text-xs" style={{ color: theme.foreground }}>
        {slide.title || "Untitled"}
      </span>
    </div>
  );
});
