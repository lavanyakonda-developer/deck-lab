"use client";

import { useEffect } from "react";
import { Redo2, Undo2 } from "lucide-react";
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
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo (Cmd/Ctrl+Z)"
        className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
      >
        <Undo2 size={18} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        aria-label="Redo"
        title="Redo (Cmd/Ctrl+Shift+Z)"
        className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
      >
        <Redo2 size={18} strokeWidth={1.75} />
      </button>
    </div>
  );
}
