"use client";

import { ChevronDown } from "lucide-react";
import {
  SLIDE_THEME_NAMES,
  SLIDE_THEMES,
  getSlideTheme,
  type SlideThemeName,
} from "@/lib/themes";
import { useDeckStore } from "@/store/deckStore";

// Controls the deck CONTENT's theme (canvas, thumbnails, PDF/PPTX
// exports) - not the app's own chrome (header/chat panel), which stays
// unthemed. See lib/themes for the token set.
export function ThemePicker() {
  const slideTheme = useDeckStore((state) => state.slideTheme);
  const setSlideTheme = useDeckStore((state) => state.setSlideTheme);
  const current = getSlideTheme(slideTheme);

  return (
    <label className="relative flex items-center gap-2 rounded-lg border border-zinc-200 py-1 pr-2 pl-2.5 text-sm dark:border-zinc-800">
      <span
        aria-hidden
        className="h-3.5 w-3.5 shrink-0 rounded-full border"
        style={{ background: current.background, borderColor: current.accent }}
      />
      <span className="sr-only">Slide theme</span>
      <select
        value={SLIDE_THEMES[slideTheme] ? slideTheme : ""}
        onChange={(e) => setSlideTheme(e.target.value as SlideThemeName)}
        className="cursor-pointer appearance-none bg-transparent pr-5 font-medium text-zinc-700 outline-none dark:text-zinc-200"
      >
        {SLIDE_THEME_NAMES.map((name) => (
          <option key={name} value={name}>
            {SLIDE_THEMES[name].label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        aria-hidden
        className="pointer-events-none absolute right-2 text-zinc-400"
      />
    </label>
  );
}
