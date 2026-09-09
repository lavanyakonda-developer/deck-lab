"use client";

import { useEffect } from "react";
import { useDeckStore } from "@/store/deckStore";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA"
  );
}

export function UndoRedo() {
  const canUndo = useDeckStore((state) => state.history.undoStack.length > 0);
  const canRedo = useDeckStore((state) => state.history.redoStack.length > 0);
  const undo = useDeckStore((state) => state.undo);
  const redo = useDeckStore((state) => state.redo);

  useEffect(() => {
    // Skip when the user is typing in an editable field (a slide's title,
    // the chat textarea, etc.) - Cmd/Ctrl+Z there should undo their typing
    // via the browser's native editing history, not jump to a deck-level
    // undo. contentEditable fields (InlineEditable.tsx) already handle
    // their own undo natively, so this only ever fires outside of one.
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifierPressed = e.metaKey || e.ctrlKey;
      if (!isModifierPressed || e.key.toLowerCase() !== "z") return;
      if (isEditableTarget(e.target)) return;

      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        aria-label="Undo (Cmd/Ctrl+Z)"
        title="Undo (Cmd/Ctrl+Z)"
        className="text-sm text-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        aria-label="Redo (Cmd/Ctrl+Shift+Z)"
        title="Redo (Cmd/Ctrl+Shift+Z)"
        className="text-sm text-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        Redo
      </button>
    </div>
  );
}
