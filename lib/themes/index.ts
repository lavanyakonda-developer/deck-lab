// Slide-content visual themes (Phase 9, N1) - deliberately presentation
// only, not part of the Deck/Slide schema (lib/schema/slide.ts). Applied
// at the render layer everywhere a slide actually renders: the live
// canvas/thumbnails (React components, via inline styles built from these
// tokens) and both exports (lib/export/pptx.ts, lib/export/pdf.ts, which
// import these same hex values directly - neither has a DOM/CSS engine to
// read from). This is what makes "the selected theme persists into a
// download" true by construction, not by re-deriving colors twice.
//
// Scoped to exactly 2 themes (light/dark, a straight color inversion) at
// the user's request - not phases.txt's original "2-3 presets with
// font pairing/spacing" sketch.

export type SlideThemeName = "light" | "dark";

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
    label: "Light",
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
    label: "Dark",
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
};

export const DEFAULT_SLIDE_THEME: SlideThemeName = "light";

export function getSlideTheme(name: SlideThemeName): SlideThemeTokens {
  return SLIDE_THEMES[name];
}
