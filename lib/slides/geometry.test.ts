import { describe, expect, it } from "vitest";
import { STAGE_HEIGHT, STAGE_WIDTH } from "@/lib/schema/slide";
import {
  MIN_ELEMENT_SIZE,
  MIN_VISIBLE,
  clampToStage,
  moveFrame,
  reorderZ,
  resizeFrame,
  snapMove,
  snapResize,
  snapTargetsFor,
} from "./geometry";

const frame = { x: 100, y: 100, w: 400, h: 200 };

describe("resizeFrame", () => {
  it("grows from the bottom-right corner, anchoring the top-left", () => {
    expect(resizeFrame(frame, "se", 50, 30)).toEqual({
      x: 100,
      y: 100,
      w: 450,
      h: 230,
    });
  });

  it("anchors the opposite edge when dragging the top-left corner", () => {
    expect(resizeFrame(frame, "nw", 50, 30)).toEqual({
      x: 150,
      y: 130,
      w: 350,
      h: 170,
    });
  });

  it("only changes width for a side handle", () => {
    expect(resizeFrame(frame, "e", 40, 999)).toEqual({ ...frame, w: 440 });
  });

  it("never shrinks below the minimum size", () => {
    const result = resizeFrame(frame, "se", -1000, -1000);
    expect(result.w).toBe(MIN_ELEMENT_SIZE);
    expect(result.h).toBe(MIN_ELEMENT_SIZE);
  });

  it("keeps the aspect ratio from a corner when asked", () => {
    const result = resizeFrame(frame, "se", 200, 0, true);
    expect(result.w / result.h).toBeCloseTo(2);
  });
});

describe("clampToStage", () => {
  it("keeps part of a dragged-away element on the stage", () => {
    const far = clampToStage(moveFrame(frame, 99999, 99999));
    expect(far.x).toBe(STAGE_WIDTH - MIN_VISIBLE);
    expect(far.y).toBe(STAGE_HEIGHT - MIN_VISIBLE);
    const negative = clampToStage(moveFrame(frame, -99999, -99999));
    expect(negative.x + negative.w).toBe(MIN_VISIBLE);
  });
});

describe("snapping", () => {
  const targets = snapTargetsFor(
    [
      {
        id: "other",
        role: "body",
        frame: { x: 600, y: 500, w: 300, h: 100 },
        content: { type: "paragraph", text: "x" },
      },
    ],
    "self",
  );

  it("snaps a moved frame's left edge to a nearby target and reports the guide", () => {
    const result = snapMove({ ...frame, x: 604 }, targets, 6);
    expect(result.frame.x).toBe(600);
    expect(result.guides.xs).toEqual([600]);
  });

  it("snaps to the stage's horizontal centre", () => {
    const centred = { ...frame, x: STAGE_WIDTH / 2 - frame.w / 2 + 3 };
    const result = snapMove(centred, targets, 6);
    expect(result.frame.x + result.frame.w / 2).toBe(STAGE_WIDTH / 2);
  });

  it("does nothing when nothing is within the threshold", () => {
    const result = snapMove({ ...frame, x: 250, y: 333 }, targets, 6);
    expect(result.frame).toEqual({ ...frame, x: 250, y: 333 });
    expect(result.guides).toEqual({ xs: [], ys: [] });
  });

  it("only snaps the edge a resize handle is moving", () => {
    const result = snapResize(
      { x: 100, y: 100, w: 497, h: 200 },
      "e",
      targets,
      6,
    );
    expect(result.frame).toEqual({ x: 100, y: 100, w: 500, h: 200 });
  });

  it("excludes the element itself from its own snap targets", () => {
    const own = snapTargetsFor(
      [
        {
          id: "self",
          role: "body",
          frame: { x: 333, y: 333, w: 10, h: 10 },
          content: { type: "paragraph", text: "x" },
        },
      ],
      "self",
    );
    expect(own.xs).not.toContain(333);
  });
});

describe("reorderZ", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const ids = (list: { id: string }[]) => list.map((i) => i.id);

  it("moves to front / back", () => {
    expect(ids(reorderZ(items, "a", "front"))).toEqual(["b", "c", "a"]);
    expect(ids(reorderZ(items, "c", "back"))).toEqual(["c", "a", "b"]);
  });

  it("moves one step forward / backward", () => {
    expect(ids(reorderZ(items, "a", "forward"))).toEqual(["b", "a", "c"]);
    expect(ids(reorderZ(items, "c", "backward"))).toEqual(["a", "c", "b"]);
  });

  it("returns the same array when nothing would change", () => {
    expect(reorderZ(items, "c", "front")).toBe(items);
    expect(reorderZ(items, "a", "backward")).toBe(items);
    expect(reorderZ(items, "missing", "front")).toBe(items);
  });
});
