// A small, pure, framework-agnostic undo/redo stack - deliberately not a
// real Zustand middleware (Zustand's `set` has no per-call metadata to
// hook into generically), so store/deckStore.ts's own mutating actions
// call these functions directly, pushing the pre-mutation snapshot before
// they apply their change. Kept as plain functions over a plain data
// shape (not a class with hidden closures) so it's trivially unit
// testable in isolation and safe to embed directly in Zustand state.
export interface HistoryState<T> {
  undoStack: T[];
  redoStack: T[];
}

export function createHistoryState<T>(): HistoryState<T> {
  return { undoStack: [], redoStack: [] };
}

// Records `snapshot` (the state as it was immediately before the mutation
// about to happen) as the new most-recent undo point. Any pending redo
// branch is discarded - the same "a new action after undo erases the old
// future" semantics as every other undo/redo implementation.
export function pushHistory<T>(
  history: HistoryState<T>,
  snapshot: T,
): HistoryState<T> {
  return { undoStack: [...history.undoStack, snapshot], redoStack: [] };
}

interface HistoryStep<T> {
  history: HistoryState<T>;
  snapshot: T;
}

// Steps one entry back. `current` is the state being moved away from -
// it's pushed onto the redo stack so `redoHistory` can step forward again.
// Returns undefined (no-op) when there's nothing to undo.
export function undoHistory<T>(
  history: HistoryState<T>,
  current: T,
): HistoryStep<T> | undefined {
  if (history.undoStack.length === 0) return undefined;
  const snapshot = history.undoStack[history.undoStack.length - 1];
  return {
    snapshot,
    history: {
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [...history.redoStack, current],
    },
  };
}

// Steps one entry forward. Mirror of undoHistory.
export function redoHistory<T>(
  history: HistoryState<T>,
  current: T,
): HistoryStep<T> | undefined {
  if (history.redoStack.length === 0) return undefined;
  const snapshot = history.redoStack[history.redoStack.length - 1];
  return {
    snapshot,
    history: {
      undoStack: [...history.undoStack, current],
      redoStack: history.redoStack.slice(0, -1),
    },
  };
}
