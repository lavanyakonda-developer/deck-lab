import { describe, expect, it } from "vitest";
import {
  createHistoryState,
  pushHistory,
  redoHistory,
  undoHistory,
} from "./historyMiddleware";

describe("historyMiddleware", () => {
  it("starts with empty undo/redo stacks", () => {
    const history = createHistoryState<number>();
    expect(history.undoStack).toEqual([]);
    expect(history.redoStack).toEqual([]);
  });

  it("push adds to the undo stack and clears any redo stack", () => {
    let history = createHistoryState<number>();
    history = pushHistory(history, 1);
    history = pushHistory(history, 2);
    expect(history.undoStack).toEqual([1, 2]);
    expect(history.redoStack).toEqual([]);
  });

  it("undo returns the most recent snapshot and moves the current value to redo", () => {
    let history = createHistoryState<string>();
    history = pushHistory(history, "a");
    history = pushHistory(history, "b");

    const result = undoHistory(history, "c");

    expect(result).toBeDefined();
    expect(result?.snapshot).toBe("b");
    expect(result?.history.undoStack).toEqual(["a"]);
    expect(result?.history.redoStack).toEqual(["c"]);
  });

  it("undo on an empty undo stack is a no-op (returns undefined)", () => {
    const history = createHistoryState<string>();
    expect(undoHistory(history, "current")).toBeUndefined();
  });

  it("redo returns the most recent redo snapshot and moves the current value to undo", () => {
    let history = createHistoryState<string>();
    history = pushHistory(history, "a");
    const afterUndo = undoHistory(history, "b");
    history = afterUndo!.history;

    const result = redoHistory(history, afterUndo!.snapshot);

    expect(result).toBeDefined();
    expect(result?.snapshot).toBe("b");
    expect(result?.history.redoStack).toEqual([]);
    expect(result?.history.undoStack).toEqual(["a"]);
  });

  it("redo on an empty redo stack is a no-op (returns undefined)", () => {
    const history = createHistoryState<string>();
    expect(redoHistory(history, "current")).toBeUndefined();
  });

  it("supports a full undo -> redo -> undo sequence, restoring the exact same values each time", () => {
    let history = createHistoryState<number>();
    history = pushHistory(history, 1); // after mutation A, undo point = 1
    history = pushHistory(history, 2); // after mutation B, undo point = 2
    // current value (after both mutations) is 3

    const undo1 = undoHistory(history, 3)!;
    expect(undo1.snapshot).toBe(2);
    history = undo1.history;

    const redo1 = redoHistory(history, undo1.snapshot)!;
    expect(redo1.snapshot).toBe(3);
    history = redo1.history;

    const undo2 = undoHistory(history, redo1.snapshot)!;
    expect(undo2.snapshot).toBe(2);
  });

  it("branches (discards the redo stack) when a new action is pushed after an undo", () => {
    let history = createHistoryState<string>();
    history = pushHistory(history, "a");
    history = pushHistory(history, "b");

    const undone = undoHistory(history, "c")!;
    history = undone.history;
    expect(history.redoStack).toEqual(["c"]);

    // A brand new action instead of a redo - the "c" future is gone.
    history = pushHistory(history, undone.snapshot);
    expect(history.redoStack).toEqual([]);
    expect(history.undoStack).toEqual(["a", "b"]);
  });
});
