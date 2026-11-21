// Slide-content visual themes - deliberately presentation
// only, not part of the Deck/Slide schema (lib/schema/slide.ts). Applied
// at the render layer everywhere a slide actually renders: the live
// canvas/thumbnails (React components, via inline styles built from these
// tokens) and both exports (lib/export/pptx.ts, lib/export/pdf.ts, which
// import these same hex values directly - neither has a DOM/CSS engine to
// read from). This is what makes "the selected theme persists into a
// download" true by construction, not by re-deriving colors twice.
//
// Five color presets (originally just light/dark; expanded at the user's
// request to a dropdown of typical presentation themes). Colors only - no
// font/spacing variation. The "light"/"dark" keys are kept unchanged so a
// value already persisted in localStorage still resolves.

export type SlideThemeName = "light" | "dark" | "corporate" | "warm" | "forest";

export interface SlideThemeTokens {
  label: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
  headerFill: string;
  accent: string;
  chartColors: string[];
}

export const SLIDE_THEMES: Record<SlideThemeName, SlideThemeTokens> = {
  light: {
    label: "Classic Light",
    background: "#ffffff",
    foreground: "#18181b", // zinc-900
    muted: "#71717a", // zinc-500
    border: "#e4e4e7", // zinc-200
    headerFill: "#f4f4f5", // zinc-100
    accent: "#2563eb", // blue-600
    chartColors: [
      "#2563eb",
      "#16a34a",
      "#d97706",
      "#dc2626",
      "#7c3aed",
      "#0891b2",
    ],
  },
  dark: {
    label: "Midnight",
    background: "#09090b", // zinc-950
    foreground: "#fafafa", // zinc-50
    muted: "#a1a1aa", // zinc-400
    border: "#3f3f46", // zinc-700
    headerFill: "#27272a", // zinc-800
    accent: "#60a5fa", // blue-400 - better contrast on a dark background
    chartColors: [
      "#60a5fa",
      "#4ade80",
      "#fbbf24",
      "#f87171",
      "#c084fc",
      "#22d3ee",
    ],
  },
  corporate: {
    label: "Corporate Blue",
    background: "#f5f8fc",
    foreground: "#0b2545",
    muted: "#4b6584",
    border: "#c7d7ea",
    headerFill: "#dbe7f5",
    accent: "#1d4ed8",
    chartColors: [
      "#1d4ed8",
      "#0b2545",
      "#38bdf8",
      "#64748b",
      "#f59e0b",
      "#0d9488",
    ],
  },
  warm: {
    label: "Warm Sand",
    background: "#fbf6ee",
    foreground: "#3d2c1e",
    muted: "#8a6f57",
    border: "#e8dccb",
    headerFill: "#f1e6d4",
    accent: "#c2410c",
    chartColors: [
      "#c2410c",
      "#d97706",
      "#a16207",
      "#78350f",
      "#be123c",
      "#65a30d",
    ],
  },
  forest: {
    label: "Forest",
    background: "#10261d",
    foreground: "#ecf5ef",
    muted: "#9cbfac",
    border: "#2b4a3c",
    headerFill: "#1b3a2c",
    accent: "#f4c95d",
    chartColors: [
      "#4ade80",
      "#f4c95d",
      "#5eead4",
      "#fb923c",
      "#a3e635",
      "#e2e8f0",
    ],
  },
};

export const DEFAULT_SLIDE_THEME: SlideThemeName = "light";

export const SLIDE_THEME_NAMES = Object.keys(SLIDE_THEMES) as SlideThemeName[];

// Falls back to the default for an unrecognized name (e.g. a stale value
// in localStorage from a theme that no longer exists) instead of crashing
// every slide render on `undefined.background`.
export function getSlideTheme(name: SlideThemeName): SlideThemeTokens {
  return SLIDE_THEMES[name] ?? SLIDE_THEMES[DEFAULT_SLIDE_THEME];
}
