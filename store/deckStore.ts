import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Deck, LayoutHints, Slide, SlideType } from "@/lib/schema/slide";
import { createId } from "@/lib/id";
import { seedDeck } from "@/lib/seedDeck";
import { DEFAULT_SLIDE_THEME, type SlideThemeName } from "@/lib/themes";
import { createDebouncedStorage } from "./debouncedStorage";
import {
  createHistoryState,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from "./historyMiddleware";

export type NewSlideInput = Omit<Slide, "id"> & { id?: string };

// What gets snapshotted for undo/redo - deliberately just the two fields
// that content-mutating actions actually change. Each snapshot's `deck` is
// a whole-new object already (every action below replaces it rather than
// mutating in place), so storing the reference straight from `state` is a
// real point-in-time copy, no deep-cloning needed.
interface DeckSnapshot {
  deck: Deck;
  selectedSlideId: string | null;
}

interface DeckState {
  deck: Deck;
  selectedSlideId: string | null;
  slideTheme: SlideThemeName;
  history: HistoryState<DeckSnapshot>;
  loadDeck: (deck: Deck) => void;
  selectSlide: (id: string | null) => void;
  setSlideTheme: (theme: SlideThemeName) => void;
  addSlide: (slide: NewSlideInput, index?: number) => string;
  updateSlide: (id: string, patch: Partial<Omit<Slide, "id">>) => void;
  deleteSlide: (id: string) => void;
  reorderSlides: (orderedIds: string[]) => void;
  changeLayout: (
    id: string,
    changes: { type?: SlideType; layout?: LayoutHints },
  ) => void;
  undo: () => void;
  redo: () => void;
}

export const useDeckStore = create<DeckState>()(
  persist(
    (set, get) => ({
      deck: seedDeck,
      selectedSlideId: seedDeck.slides[0]?.id ?? null,
      slideTheme: DEFAULT_SLIDE_THEME,
      history: createHistoryState<DeckSnapshot>(),

      // Manual edits and AI tool calls both go through these same actions
      // (see CLAUDE.md) - so pushing the pre-mutation snapshot here, once
      // per action, is enough to make undo/redo cover both sources with no
      // separate mutation path, per Phase 8's requirement.
      loadDeck: (deck) =>
        set((state) => ({
          deck,
          selectedSlideId: deck.slides[0]?.id ?? null,
          history: pushHistory(state.history, {
            deck: state.deck,
            selectedSlideId: state.selectedSlideId,
          }),
        })),

      // Pure navigation, not a content change - not part of undo history.
      selectSlide: (id) => set({ selectedSlideId: id }),

      // Presentation preference, not deck content (lib/themes) - not part
      // of undo history either, same reasoning as selectSlide.
      setSlideTheme: (theme) => set({ slideTheme: theme }),

      addSlide: (slide, index) => {
        const id = slide.id ?? createId("slide");
        const newSlide: Slide = { ...slide, id };
        set((state) => {
          const slides = [...state.deck.slides];
          const insertAt =
            index === undefined
              ? slides.length
              : Math.max(0, Math.min(index, slides.length));
          slides.splice(insertAt, 0, newSlide);
          return {
            deck: { ...state.deck, slides },
            selectedSlideId: id,
            history: pushHistory(state.history, {
              deck: state.deck,
              selectedSlideId: state.selectedSlideId,
            }),
          };
        });
        return id;
      },

      updateSlide: (id, patch) =>
        set((state) => {
          if (!state.deck.slides.some((slide) => slide.id === id)) {
            return state;
          }
          return {
            deck: {
              ...state.deck,
              slides: state.deck.slides.map((slide) =>
                slide.id === id ? { ...slide, ...patch } : slide,
              ),
            },
            history: pushHistory(state.history, {
              deck: state.deck,
              selectedSlideId: state.selectedSlideId,
            }),
          };
        }),

      deleteSlide: (id) =>
        set((state) => {
          const index = state.deck.slides.findIndex((slide) => slide.id === id);
          if (index === -1) return state;
          const slides = state.deck.slides.filter((slide) => slide.id !== id);
          let selectedSlideId = state.selectedSlideId;
          if (selectedSlideId === id) {
            const fallback = slides[Math.min(index, slides.length - 1)];
            selectedSlideId = fallback ? fallback.id : null;
          }
          return {
            deck: { ...state.deck, slides },
            selectedSlideId,
            history: pushHistory(state.history, {
              deck: state.deck,
              selectedSlideId: state.selectedSlideId,
            }),
          };
        }),

      reorderSlides: (orderedIds) =>
        set((state) => {
          const currentIds = state.deck.slides.map((slide) => slide.id);
          const isSamePermutation =
            orderedIds.length === currentIds.length &&
            currentIds.every((id) => orderedIds.includes(id));
          if (!isSamePermutation) {
            return state;
          }
          const byId = new Map(
            state.deck.slides.map((slide) => [slide.id, slide]),
          );
          const slides = orderedIds.map((id) => byId.get(id)!);
          return {
            deck: { ...state.deck, slides },
            history: pushHistory(state.history, {
              deck: state.deck,
              selectedSlideId: state.selectedSlideId,
            }),
          };
        }),

      changeLayout: (id, changes) =>
        set((state) => {
          if (!state.deck.slides.some((slide) => slide.id === id)) {
            return state;
          }
          return {
            deck: {
              ...state.deck,
              slides: state.deck.slides.map((slide) =>
                slide.id === id
                  ? {
                      ...slide,
                      ...(changes.type ? { type: changes.type } : {}),
                      layout: { ...slide.layout, ...changes.layout },
                    }
                  : slide,
              ),
            },
            history: pushHistory(state.history, {
              deck: state.deck,
              selectedSlideId: state.selectedSlideId,
            }),
          };
        }),

      undo: () => {
        const state = get();
        const result = undoHistory(state.history, {
          deck: state.deck,
          selectedSlideId: state.selectedSlideId,
        });
        if (!result) return;
        set({
          deck: result.snapshot.deck,
          selectedSlideId: result.snapshot.selectedSlideId,
          history: result.history,
        });
      },

      redo: () => {
        const state = get();
        const result = redoHistory(state.history, {
          deck: state.deck,
          selectedSlideId: state.selectedSlideId,
        });
        if (!result) return;
        set({
          deck: result.snapshot.deck,
          selectedSlideId: result.snapshot.selectedSlideId,
          history: result.history,
        });
      },
    }),
    {
      name: "deck-lab:deck",
      storage: createJSONStorage(() => createDebouncedStorage()),
      skipHydration: true,
      // Undo/redo history is deliberately session-only - persisting every
      // past deck snapshot would bloat localStorage indefinitely, and
      // resuming an undo stack across a page reload isn't expected UX.
      partialize: (state) => ({
        deck: state.deck,
        selectedSlideId: state.selectedSlideId,
        slideTheme: state.slideTheme,
      }),
    },
  ),
);
