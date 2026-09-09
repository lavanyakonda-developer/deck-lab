"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { createBlankSlide } from "@/lib/blankSlide";
import { useDeckStore } from "@/store/deckStore";
import { SlideThumbnail } from "./SlideThumbnail";

export function ThumbnailRail() {
  const slides = useDeckStore((state) => state.deck.slides);
  const selectedSlideId = useDeckStore((state) => state.selectedSlideId);
  const selectSlide = useDeckStore((state) => state.selectSlide);
  const addSlide = useDeckStore((state) => state.addSlide);
  const deleteSlide = useDeckStore((state) => state.deleteSlide);
  const reorderSlides = useDeckStore((state) => state.reorderSlides);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const ids = slides.map((slide) => slide.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    reorderSlides(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <div className="flex h-24 w-full min-w-0 shrink-0 items-center gap-3 overflow-x-auto border-t border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
      {slides.length === 0 ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          Slide thumbnails will appear here.
        </p>
      ) : (
        <DndContext
          id="thumbnail-rail"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
            {slides.map((slide, index) => (
              <SlideThumbnail
                key={slide.id}
                slide={slide}
                index={index}
                isSelected={slide.id === selectedSlideId}
                onSelect={() => selectSlide(slide.id)}
                onDelete={() => deleteSlide(slide.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
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
