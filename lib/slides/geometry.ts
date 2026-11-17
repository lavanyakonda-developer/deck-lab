import {
  STAGE_HEIGHT,
  STAGE_WIDTH,
  type Frame,
  type SlideElement,
} from "@/lib/schema/slide";

// Pure geometry for direct manipulation on the stage (move / resize /
// snap). Everything is in stage units (1920x1080); callers convert pointer
// deltas from screen pixels by dividing by the stage's render scale.

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const RESIZE_HANDLES: ResizeHandle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

export const MIN_ELEMENT_SIZE = 40;
// How much of an element must stay on the stage, so nothing can be dragged
// fully out of reach.
export const MIN_VISIBLE = 40;

export function moveFrame(frame: Frame, dx: number, dy: number): Frame {
  return { ...frame, x: frame.x + dx, y: frame.y + dy };
}

export function resizeFrame(
  start: Frame,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  keepAspect = false,
): Frame {
  let { x, y, w, h } = start;
  if (handle.includes("e")) w = start.w + dx;
  if (handle.includes("w")) w = start.w - dx;
  if (handle.includes("s")) h = start.h + dy;
  if (handle.includes("n")) h = start.h - dy;

  w = Math.max(MIN_ELEMENT_SIZE, w);
  h = Math.max(MIN_ELEMENT_SIZE, h);

  // Proportional resize only makes sense from a corner.
  if (keepAspect && handle.length === 2) {
    const ratio = start.w / start.h;
    if (w / h > ratio) h = w / ratio;
    else w = h * ratio;
  }

  // Anchor the opposite edge.
  if (handle.includes("w")) x = start.x + start.w - w;
  if (handle.includes("n")) y = start.y + start.h - h;
  return { x, y, w, h };
}

export function clampToStage(frame: Frame): Frame {
  return {
    ...frame,
    x: Math.min(
      STAGE_WIDTH - MIN_VISIBLE,
      Math.max(MIN_VISIBLE - frame.w, frame.x),
    ),
    y: Math.min(
      STAGE_HEIGHT - MIN_VISIBLE,
      Math.max(MIN_VISIBLE - frame.h, frame.y),
    ),
  };
}

export interface SnapTargets {
  xs: number[];
  ys: number[];
}

export interface Guides {
  xs: number[];
  ys: number[];
}

// Lines worth snapping to: the stage's edges and centre lines, and every
// other element's edges and centre lines.
export function snapTargetsFor(
  elements: SlideElement[],
  excludeId: string,
): SnapTargets {
  const xs = [0, STAGE_WIDTH / 2, STAGE_WIDTH];
  const ys = [0, STAGE_HEIGHT / 2, STAGE_HEIGHT];
  for (const el of elements) {
    if (el.id === excludeId) continue;
    const { x, y, w, h } = el.frame;
    xs.push(x, x + w / 2, x + w);
    ys.push(y, y + h / 2, y + h);
  }
  return { xs, ys };
}

// Smallest offset that lands one of `points` on one of `targets`, if any
// is within `threshold`.
function nearestSnap(
  points: number[],
  targets: number[],
  threshold: number,
): { offset: number; line: number } | null {
  let best: { offset: number; line: number } | null = null;
  for (const p of points) {
    for (const t of targets) {
      const offset = t - p;
      if (
        Math.abs(offset) <= threshold &&
        (!best || Math.abs(offset) < Math.abs(best.offset))
      ) {
        best = { offset, line: t };
      }
    }
  }
  return best;
}

export function snapMove(
  frame: Frame,
  targets: SnapTargets,
  threshold: number,
): { frame: Frame; guides: Guides } {
  const sx = nearestSnap(
    [frame.x, frame.x + frame.w / 2, frame.x + frame.w],
    targets.xs,
    threshold,
  );
  const sy = nearestSnap(
    [frame.y, frame.y + frame.h / 2, frame.y + frame.h],
    targets.ys,
    threshold,
  );
  return {
    frame: {
      ...frame,
      x: frame.x + (sx?.offset ?? 0),
      y: frame.y + (sy?.offset ?? 0),
    },
    guides: { xs: sx ? [sx.line] : [], ys: sy ? [sy.line] : [] },
  };
}

// Snaps only the edges a resize handle is actually moving.
export function snapResize(
  frame: Frame,
  handle: ResizeHandle,
  targets: SnapTargets,
  threshold: number,
): { frame: Frame; guides: Guides } {
  let { x, y, w, h } = frame;
  const guides: Guides = { xs: [], ys: [] };

  if (handle.includes("e")) {
    const s = nearestSnap([x + w], targets.xs, threshold);
    if (s && w + s.offset >= MIN_ELEMENT_SIZE) {
      w += s.offset;
      guides.xs.push(s.line);
    }
  } else if (handle.includes("w")) {
    const s = nearestSnap([x], targets.xs, threshold);
    if (s && w - s.offset >= MIN_ELEMENT_SIZE) {
      x += s.offset;
      w -= s.offset;
      guides.xs.push(s.line);
    }
  }
  if (handle.includes("s")) {
    const s = nearestSnap([y + h], targets.ys, threshold);
    if (s && h + s.offset >= MIN_ELEMENT_SIZE) {
      h += s.offset;
      guides.ys.push(s.line);
    }
  } else if (handle.includes("n")) {
    const s = nearestSnap([y], targets.ys, threshold);
    if (s && h - s.offset >= MIN_ELEMENT_SIZE) {
      y += s.offset;
      h -= s.offset;
      guides.ys.push(s.line);
    }
  }
  return { frame: { x, y, w, h }, guides };
}

export type ZOrderMove = "front" | "back" | "forward" | "backward";

// Elements paint in array order, so stacking order is array order.
export function reorderZ<T extends { id: string }>(
  items: T[],
  id: string,
  move: ZOrderMove,
): T[] {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  const target =
    move === "front"
      ? next.length
      : move === "back"
        ? 0
        : move === "forward"
          ? Math.min(next.length, index + 1)
          : Math.max(0, index - 1);
  if (target === index) return items; // already there - no change
  next.splice(target, 0, item);
  return next;
}
