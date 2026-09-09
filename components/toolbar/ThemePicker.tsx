"use client";

import { SLIDE_THEMES, type SlideThemeName } from "@/lib/themes";
import { useDeckStore } from "@/store/deckStore";

const OPTIONS: SlideThemeName[] = ["light", "dark"];

// Controls the deck CONTENT's theme (canvas, thumbnails, PDF/PPTX
// exports) - not the app's own chrome (header/chat panel), which stays
// unthemed. See lib/themes for the token set and CLAUDE.md's Phase 9
// note for why the two are kept separate.
export function ThemePicker() {
  const slideTheme = useDeckStore((state) => state.slideTheme);
  const setSlideTheme = useDeckStore((state) => state.setSlideTheme);

  return (
    <div className="flex items-center gap-1 rounded-md border border-zinc-200 p-0.5 dark:border-zinc-800">
      {OPTIONS.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => setSlideTheme(name)}
          aria-pressed={slideTheme === name}
          className={`rounded px-2 py-1 text-sm transition-colors ${
            slideTheme === name
              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          {SLIDE_THEMES[name].label}
        </button>
      ))}
    </div>
  );
}
