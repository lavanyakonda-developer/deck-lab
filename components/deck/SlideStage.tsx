"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  STAGE_HEIGHT,
  STAGE_WIDTH,
  type Frame,
  type Slide,
  type SlideElement,
} from "@/lib/schema/slide";
import {
  RESIZE_HANDLES,
  clampToStage,
  moveFrame,
  resizeFrame,
  snapMove,
  snapResize,
  snapTargetsFor,
  type Guides,
  type ResizeHandle,
} from "@/lib/slides/geometry";
import type { SlideThemeTokens } from "@/lib/themes";
import { useDeckStore } from "@/store/deckStore";
import { SlideElementView } from "./elements/SlideElementView";

const SELECTION_COLOR = "#3b82f6";
const GUIDE_COLOR = "#ec4899";
const HANDLE_PX = 10; // screen pixels, independent of zoom
const SNAP_PX = 6;
const DRAG_START_PX = 3;
const NUDGE = 10; // stage units per arrow key press (x5 with Shift)

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

function handlePosition(handle: ResizeHandle, frame: Frame) {
  const x = handle.includes("w")
    ? 0
    : handle.includes("e")
      ? frame.w
      : frame.w / 2;
  const y = handle.includes("n")
    ? 0
    : handle.includes("s")
      ? frame.h
      : frame.h / 2;
  return { x, y };
}

export function isTextEditable(element: SlideElement): boolean {
  if (element.role === "decoration") return false;
  const type = element.content.type;
  return (
    type === "text" ||
    type === "bullets" ||
    type === "paragraph" ||
    type === "table"
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function blurActiveEditable() {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.isContentEditable) active.blur();
}

// Puts the text caret where the user clicked, so entering edit mode feels
// like clicking straight into the text.
function placeCaret(editable: HTMLElement, x: number, y: number) {
  let range: Range | null = null;
  if ("caretPositionFromPoint" in document) {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
    }
  } else if ("caretRangeFromPoint" in document) {
    range = (document as Document).caretRangeFromPoint(x, y);
  }
  if (!range || !editable.contains(range.startContainer)) return;
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

interface Draft {
  elementId: string;
  frame: Frame;
  guides: Guides;
}

// Renders a slide's elements at their absolute positions on a fixed
// 1920x1080 stage, scaled uniformly to fit the container's width, and
// handles direct manipulation: select, move, resize (with snapping), text
// editing, keyboard delete/nudge. A drag's in-progress frame lives in local
// state and is committed to the store once, on release - one undo step.
export function SlideStage({
  slide,
  theme,
}: {
  slide: Slide;
  theme: SlideThemeTokens;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // null until measured - the stage stays hidden rather than flashing at
  // the wrong size on first paint.
  const [scale, setScale] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedElementId = useDeckStore((state) => state.selectedElementId);
  const selectElement = useDeckStore((state) => state.selectElement);
  const setElementFrame = useDeckStore((state) => state.setElementFrame);

  const selected =
    slide.elements.find((el) => el.id === selectedElementId) ?? null;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // ResizeObserver fires once immediately on observe(), then on resize.
    const observer = new ResizeObserver(() =>
      setScale(el.clientWidth / STAGE_WIDTH),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const enterEdit = useCallback((elementId: string, x: number, y: number) => {
    setEditingId(elementId);
    // Wait for the re-render that removes the element's drag overlay.
    requestAnimationFrame(() => {
      const box = document.querySelector<HTMLElement>(
        `[data-element-id="${CSS.escape(elementId)}"]`,
      );
      if (!box) return;
      const hit = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>('[contenteditable="true"]');
      const editable =
        hit && box.contains(hit)
          ? hit
          : box.querySelector<HTMLElement>('[contenteditable="true"]');
      if (!editable) return;
      editable.focus();
      placeCaret(editable, x, y);
    });
  }, []);

  const startGesture = (
    e: React.PointerEvent,
    element: SlideElement,
    mode: "move" | ResizeHandle,
  ) => {
    if (e.button !== 0 || scale === null) return;
    e.preventDefault();
    e.stopPropagation();
    blurActiveEditable();

    const wasSelected = selectedElementId === element.id;
    selectElement(element.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const start = element.frame;
    const targets = snapTargetsFor(slide.elements, element.id);
    const threshold = SNAP_PX / scale;
    let latest = start;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      if (
        !moved &&
        Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_START_PX
      ) {
        return;
      }
      moved = true;
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      const result =
        mode === "move"
          ? snapMove(moveFrame(start, dx, dy), targets, threshold)
          : snapResize(
              resizeFrame(start, mode, dx, dy, ev.shiftKey),
              mode,
              targets,
              threshold,
            );
      latest = mode === "move" ? clampToStage(result.frame) : result.frame;
      setDraft({ elementId: element.id, frame: latest, guides: result.guides });
    };

    const finish = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      setDraft(null);
      if (moved && ev.type === "pointerup") {
        setElementFrame(slide.id, element.id, latest);
      } else if (
        !moved &&
        mode === "move" &&
        wasSelected &&
        isTextEditable(element)
      ) {
        // Click on an already-selected text element: start typing.
        enterEdit(element.id, ev.clientX, ev.clientY);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  // Keyboard: Delete/Backspace removes, arrows nudge, Escape deselects -
  // only while an element is selected and focus isn't in a text field.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useDeckStore.getState();
      const elementId = state.selectedElementId;
      if (!elementId || isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const element = slide.elements.find((el) => el.id === elementId);
      if (!element) return;

      if (e.key === "Escape") {
        e.preventDefault();
        state.selectElement(null);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        state.deleteElement(slide.id, elementId);
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? NUDGE * 5 : NUDGE;
        const dx =
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy =
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        state.setElementFrame(
          slide.id,
          elementId,
          clampToStage(moveFrame(element.frame, dx, dy)),
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slide]);

  const px = (screenPx: number) => (scale ? screenPx / scale : 0);
  const selectedFrame =
    selected && draft?.elementId === selected.id
      ? draft.frame
      : selected?.frame;
  const isEditingSelected = selected !== null && editingId === selected.id;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <div
        className="absolute top-0 left-0"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) selectElement(null);
        }}
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `scale(${scale ?? 0})`,
          transformOrigin: "0 0",
          visibility: scale === null ? "hidden" : undefined,
        }}
      >
        {slide.elements.map((element) => (
          <SlideElementView
            key={element.id}
            slideId={slide.id}
            element={element}
            frame={
              draft?.elementId === element.id ? draft.frame : element.frame
            }
            theme={theme}
            isEditing={editingId === element.id}
            onPointerDown={(e) => startGesture(e, element, "move")}
            onDoubleClick={(e) => {
              if (isTextEditable(element)) {
                enterEdit(element.id, e.clientX, e.clientY);
              }
            }}
            onEditEnd={() =>
              setEditingId((current) =>
                current === element.id ? null : current,
              )
            }
          />
        ))}

        {selected && selectedFrame && (
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: selectedFrame.x,
              top: selectedFrame.y,
              width: selectedFrame.w,
              height: selectedFrame.h,
              outline: `${px(2)}px ${isEditingSelected ? "dashed" : "solid"} ${SELECTION_COLOR}`,
            }}
          >
            {!isEditingSelected &&
              RESIZE_HANDLES.map((handle) => {
                const pos = handlePosition(handle, selectedFrame);
                return (
                  <div
                    key={handle}
                    data-handle={handle}
                    onPointerDown={(e) => startGesture(e, selected, handle)}
                    className="pointer-events-auto absolute rounded-sm bg-white"
                    style={{
                      left: pos.x - px(HANDLE_PX / 2),
                      top: pos.y - px(HANDLE_PX / 2),
                      width: px(HANDLE_PX),
                      height: px(HANDLE_PX),
                      border: `${px(1.5)}px solid ${SELECTION_COLOR}`,
                      cursor: HANDLE_CURSORS[handle],
                    }}
                  />
                );
              })}
          </div>
        )}

        {draft?.guides.xs.map((x) => (
          <div
            key={`gx-${x}`}
            aria-hidden
            className="pointer-events-none absolute top-0"
            style={{
              left: x - px(0.5),
              width: px(1),
              height: STAGE_HEIGHT,
              background: GUIDE_COLOR,
            }}
          />
        ))}
        {draft?.guides.ys.map((y) => (
          <div
            key={`gy-${y}`}
            aria-hidden
            className="pointer-events-none absolute left-0"
            style={{
              top: y - px(0.5),
              height: px(1),
              width: STAGE_WIDTH,
              background: GUIDE_COLOR,
            }}
          />
        ))}
      </div>
    </div>
  );
}
