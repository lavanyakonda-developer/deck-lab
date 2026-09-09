"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Slide } from "@/lib/schema/slide";

interface SlideThumbnailProps {
  slide: Slide;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function SlideThumbnail({
  slide,
  index,
  isSelected,
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
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-current={isSelected}
      className={`group relative flex h-16 w-28 shrink-0 cursor-grab flex-col justify-between rounded-md border px-2 py-1.5 text-left transition-colors active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      } ${
        isSelected
          ? "border-zinc-900 bg-zinc-50 dark:border-zinc-50 dark:bg-zinc-900"
          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`Delete slide ${index + 1}`}
        className="absolute top-1 right-1 hidden h-4 w-4 items-center justify-center rounded-full bg-zinc-900/80 text-[10px] leading-none text-white hover:bg-zinc-900 group-hover:flex dark:bg-zinc-50/80 dark:text-zinc-900 dark:hover:bg-zinc-50"
      >
        ×
      </button>
      <span className="text-[10px] font-medium text-zinc-400">{index + 1}</span>
      <span className="truncate text-xs text-zinc-700 dark:text-zinc-300">
        {slide.title || "Untitled"}
      </span>
    </div>
  );
}
