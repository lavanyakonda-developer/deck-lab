import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Deck, LayoutHints, Slide, SlideType } from "@/lib/schema/slide";
import { createId } from "@/lib/id";
import { seedDeck } from "@/lib/seedDeck";

export type NewSlideInput = Omit<Slide, "id"> & { id?: string };

interface DeckState {
  deck: Deck;
  selectedSlideId: string | null;
  loadDeck: (deck: Deck) => void;
  selectSlide: (id: string | null) => void;
  addSlide: (slide: NewSlideInput, index?: number) => string;
  updateSlide: (id: string, patch: Partial<Omit<Slide, "id">>) => void;
  deleteSlide: (id: string) => void;
  reorderSlides: (orderedIds: string[]) => void;
  changeLayout: (
    id: string,
    changes: { type?: SlideType; layout?: LayoutHints },
  ) => void;
}

export const useDeckStore = create<DeckState>()(
  persist(
    (set) => ({
      deck: seedDeck,
      selectedSlideId: seedDeck.slides[0]?.id ?? null,

      loadDeck: (deck) =>
        set({ deck, selectedSlideId: deck.slides[0]?.id ?? null }),

      selectSlide: (id) => set({ selectedSlideId: id }),

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
          return { deck: { ...state.deck, slides }, selectedSlideId: id };
        });
        return id;
      },

      updateSlide: (id, patch) =>
        set((state) => ({
          deck: {
            ...state.deck,
            slides: state.deck.slides.map((slide) =>
              slide.id === id ? { ...slide, ...patch } : slide,
            ),
          },
        })),

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
          return { deck: { ...state.deck, slides }, selectedSlideId };
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
          return { deck: { ...state.deck, slides } };
        }),

      changeLayout: (id, changes) =>
        set((state) => ({
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
        })),
    }),
    {
      name: "deck-lab:deck",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
