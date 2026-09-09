"use client";

import { useEffect } from "react";
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
import { getSlideTheme } from "@/lib/themes";
import { useDeckStore } from "@/store/deckStore";
import { SlideThumbnail } from "./SlideThumbnail";

function thumbnailElementId(slideId: string): string {
  return `slide-thumbnail-${slideId}`;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA"
  );
}

export function ThumbnailRail() {
  const slides = useDeckStore((state) => state.deck.slides);
  const selectedSlideId = useDeckStore((state) => state.selectedSlideId);
  const slideTheme = useDeckStore((state) => state.slideTheme);
  const theme = getSlideTheme(slideTheme);
  const selectSlide = useDeckStore((state) => state.selectSlide);
  const addSlide = useDeckStore((state) => state.addSlide);
  const deleteSlide = useDeckStore((state) => state.deleteSlide);
  const reorderSlides = useDeckStore((state) => state.reorderSlides);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const ids = slides.map((slide) => slide.id);

  // Keep the selected thumbnail in view when it changes (e.g. via the
  // ArrowLeft/ArrowRight navigation below) - without this, stepping past
  // the visible edge of the rail would move the selection with nothing on
  // screen to show for it.
  useEffect(() => {
    if (!selectedSlideId) return;
    document
      .getElementById(thumbnailElementId(selectedSlideId))
      ?.scrollIntoView({
        behavior: "smooth",
        inline: "nearest",
        block: "nearest",
      });
  }, [selectedSlideId]);

  // ArrowLeft/ArrowRight step the selection to the previous/next slide,
  // skipped while typing in an editable field (a slide's title, the chat
  // textarea, etc.) so this doesn't hijack normal text cursor movement.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (isEditableTarget(e.target)) return;

      const currentIds = useDeckStore.getState().deck.slides.map((s) => s.id);
      const currentSelectedId = useDeckStore.getState().selectedSlideId;
      const index = currentIds.indexOf(currentSelectedId ?? "");

      if (e.key === "ArrowLeft") {
        if (index <= 0) return;
        e.preventDefault();
        selectSlide(currentIds[index - 1]);
      } else {
        if (index === -1 || index >= currentIds.length - 1) return;
        e.preventDefault();
        selectSlide(currentIds[index + 1]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectSlide]);

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
                elementId={thumbnailElementId(slide.id)}
                slide={slide}
                index={index}
                theme={theme}
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
