import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  Deck,
  ElementContent,
  ElementStyle,
  Frame,
  LayoutHints,
  Slide,
  SlideElement,
  SlideType,
} from "@/lib/schema/slide";
import { stripUndefined } from "@/lib/slides/elementFactory";
import { reorderZ, type ZOrderMove } from "@/lib/slides/geometry";
import { createId } from "@/lib/id";
import {
  applyContentPatch,
  applyLayoutChange,
  migrateLegacySlide,
  type SlideContentPatch,
} from "@/lib/slides/layoutEngine";
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
  // The element selected on the canvas (UI state - not persisted, not in
  // undo history). Always belongs to the selected slide.
  selectedElementId: string | null;
  slideTheme: SlideThemeName;
  history: HistoryState<DeckSnapshot>;
  loadDeck: (deck: Deck) => void;
  selectSlide: (id: string | null) => void;
  selectElement: (id: string | null) => void;
  setSlideTheme: (theme: SlideThemeName) => void;
  addSlide: (slide: NewSlideInput, index?: number) => string;
  // Semantic patch (title/subtitle/body/column titles) - the AI's
  // update_slide. Mapped onto the slide's elements by lib/slides/layoutEngine.
  updateSlide: (id: string, patch: SlideContentPatch) => void;
  // Replaces one element's content - manual editing on the canvas, and
  // async image generation filling in an image element's url.
  updateElement: (
    slideId: string,
    elementId: string,
    content: ElementContent,
  ) => void;
  // Adds an element on top of the slide and selects it.
  addElement: (slideId: string, element: SlideElement) => void;
  // Merges style fields; an explicit `undefined` clears that field.
  updateElementStyle: (
    slideId: string,
    elementId: string,
    patch: Partial<ElementStyle>,
  ) => void;
  setElementFrame: (slideId: string, elementId: string, frame: Frame) => void;
  deleteElement: (slideId: string, elementId: string) => void;
  reorderElement: (
    slideId: string,
    elementId: string,
    move: ZOrderMove,
  ) => void;
  deleteSlide: (id: string) => void;
  reorderSlides: (orderedIds: string[]) => void;
  changeLayout: (
    id: string,
    changes: { type?: SlideType; layout?: LayoutHints },
  ) => void;
  undo: () => void;
  redo: () => void;
}

// Applies `edit` to one slide's element list, as one undoable step. A
// no-op (same state, no history entry) if the slide or element is missing
// or nothing changed.
function editElements(
  state: DeckState,
  slideId: string,
  elementId: string,
  edit: (elements: SlideElement[]) => SlideElement[],
): DeckState | Partial<DeckState> {
  const slide = state.deck.slides.find((s) => s.id === slideId);
  if (!slide?.elements.some((el) => el.id === elementId)) return state;
  const elements = edit(slide.elements);
  if (elements === slide.elements) return state;
  return {
    deck: {
      ...state.deck,
      slides: state.deck.slides.map((s) =>
        s.id === slideId ? { ...s, elements } : s,
      ),
    },
    history: pushHistory(state.history, {
      deck: state.deck,
      selectedSlideId: state.selectedSlideId,
    }),
  };
}

// Cached on globalThis so Fast Refresh reuses this store instead of
// recreating it from seedDeck on every edit to this file.
function buildDeckStore() {
  return create<DeckState>()(
    persist(
      (set, get) => ({
        deck: seedDeck,
        selectedSlideId: seedDeck.slides[0]?.id ?? null,
        selectedElementId: null,
        slideTheme: DEFAULT_SLIDE_THEME,
        history: createHistoryState<DeckSnapshot>(),

        // Manual edits and AI tool calls both go through these same actions,
        // so pushing the pre-mutation snapshot here, once per action, is
        // enough to make undo/redo cover both sources with no separate
        // mutation path.
        loadDeck: (deck) =>
          set((state) => ({
            deck,
            selectedSlideId: deck.slides[0]?.id ?? null,
            selectedElementId: null,
            history: pushHistory(state.history, {
              deck: state.deck,
              selectedSlideId: state.selectedSlideId,
            }),
          })),

        // Pure navigation, not a content change - not part of undo history.
        selectSlide: (id) =>
          set((state) =>
            id === state.selectedSlideId
              ? state
              : { selectedSlideId: id, selectedElementId: null },
          ),

        selectElement: (id) => set({ selectedElementId: id }),

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
              selectedElementId: null,
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
                  slide.id === id ? applyContentPatch(slide, patch) : slide,
                ),
              },
              history: pushHistory(state.history, {
                deck: state.deck,
                selectedSlideId: state.selectedSlideId,
              }),
            };
          }),

        updateElement: (slideId, elementId, content) =>
          set((state) =>
            editElements(state, slideId, elementId, (elements) =>
              elements.map((el) =>
                el.id === elementId ? { ...el, content } : el,
              ),
            ),
          ),

        addElement: (slideId, element) =>
          set((state) => {
            if (!state.deck.slides.some((s) => s.id === slideId)) return state;
            return {
              deck: {
                ...state.deck,
                slides: state.deck.slides.map((s) =>
                  s.id === slideId
                    ? { ...s, elements: [...s.elements, element] }
                    : s,
                ),
              },
              selectedSlideId: slideId,
              selectedElementId: element.id,
              history: pushHistory(state.history, {
                deck: state.deck,
                selectedSlideId: state.selectedSlideId,
              }),
            };
          }),

        updateElementStyle: (slideId, elementId, patch) =>
          set((state) =>
            editElements(state, slideId, elementId, (elements) =>
              elements.map((el) =>
                el.id === elementId
                  ? { ...el, style: stripUndefined({ ...el.style, ...patch }) }
                  : el,
              ),
            ),
          ),

        // Called once per gesture (on pointer release), never per pointer
        // move, so one drag/resize is one undo step.
        setElementFrame: (slideId, elementId, frame) =>
          set((state) =>
            editElements(state, slideId, elementId, (elements) =>
              elements.map((el) =>
                el.id === elementId ? { ...el, frame } : el,
              ),
            ),
          ),

        deleteElement: (slideId, elementId) =>
          set((state) => {
            const next = editElements(state, slideId, elementId, (elements) =>
              elements.filter((el) => el.id !== elementId),
            );
            if (next === state) return state;
            return {
              ...next,
              selectedElementId:
                state.selectedElementId === elementId
                  ? null
                  : state.selectedElementId,
            };
          }),

        reorderElement: (slideId, elementId, move) =>
          set((state) =>
            editElements(state, slideId, elementId, (elements) =>
              reorderZ(elements, elementId, move),
            ),
          ),

        deleteSlide: (id) =>
          set((state) => {
            const index = state.deck.slides.findIndex(
              (slide) => slide.id === id,
            );
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
              selectedElementId:
                selectedSlideId === state.selectedSlideId
                  ? state.selectedElementId
                  : null,
              history: pushHistory(state.history, {
                deck: state.deck,
                selectedSlideId: state.selectedSlideId,
              }),
            };
          }),

        // Only accepts a full permutation of the current slide ids - a
        // partial, duplicated, or unknown id list (e.g. a malformed AI
        // reorder_slides call) is ignored rather than dropping slides.
        reorderSlides: (orderedIds) =>
          set((state) => {
            const byId = new Map(
              state.deck.slides.map((slide) => [slide.id, slide]),
            );
            const isPermutation =
              orderedIds.length === byId.size &&
              new Set(orderedIds).size === byId.size &&
              orderedIds.every((id) => byId.has(id));
            if (!isPermutation) return state;
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
                  slide.id === id ? applyLayoutChange(slide, changes) : slide,
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
        // v1: slides moved from fixed-layout fields (title/body/layout) to
        // positioned elements - decks saved before that are re-laid out
        // through the layout engine on load, so nothing is lost.
        version: 1,
        migrate: (persisted) => {
          const state = persisted as { deck?: Deck } | undefined;
          if (state?.deck?.slides) {
            state.deck = {
              ...state.deck,
              slides: state.deck.slides.map(migrateLegacySlide),
            };
          }
          return state as DeckState;
        },
        partialize: (state) => ({
          deck: state.deck,
          selectedSlideId: state.selectedSlideId,
          slideTheme: state.slideTheme,
        }),
      },
    ),
  );
}

// The cache key is versioned alongside the persisted schema version: after a
// slide-shape change, a dev server / Fast Refresh session would otherwise
// keep serving the old cached store (old-shaped slides) and crash.
declare global {
  var __deckLabDeckStoreV1: ReturnType<typeof buildDeckStore> | undefined;
}

export const useDeckStore =
  globalThis.__deckLabDeckStoreV1 ??
  (globalThis.__deckLabDeckStoreV1 = buildDeckStore());
