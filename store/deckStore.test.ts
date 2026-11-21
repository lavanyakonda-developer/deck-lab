import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Deck, Slide } from "@/lib/schema/slide";
import {
  getSlideContent,
  getSlideTitle,
  materializeDeck,
  materializeSlide,
} from "@/lib/slides/layoutEngine";
import { createDefaultElement } from "@/lib/slides/elementFactory";
import { useDeckStore } from "./deckStore";
import { createHistoryState } from "./historyMiddleware";

const LEGACY_SLIDES = [
  { id: "a", type: "title" as const, title: "First", body: [] },
  { id: "b", type: "content" as const, title: "Second", body: [] },
  { id: "c", type: "content" as const, title: "Third", body: [] },
];

function makeDeck(): Deck {
  return materializeDeck({
    id: "deck-1",
    title: "Test Deck",
    slides: LEGACY_SLIDES,
  });
}

function slideById(id: string): Slide {
  return useDeckStore.getState().deck.slides.find((s) => s.id === id)!;
}

function titleOf(id: string): string {
  return getSlideTitle(slideById(id));
}

beforeEach(() => {
  localStorage.clear();
  const deck = makeDeck();
  useDeckStore.setState({
    deck,
    selectedSlideId: deck.slides[0].id,
    slideTheme: "light",
    history: createHistoryState(),
  });
});

describe("deckStore", () => {
  it("addSlide inserts at the end by default and selects it", () => {
    const id = useDeckStore
      .getState()
      .addSlide(
        materializeSlide({ type: "content", title: "New Slide", body: [] }),
      );
    const state = useDeckStore.getState();
    expect(state.deck.slides).toHaveLength(4);
    expect(state.deck.slides[3].id).toBe(id);
    expect(state.selectedSlideId).toBe(id);
  });

  it("addSlide inserts at a specific index", () => {
    const id = useDeckStore
      .getState()
      .addSlide(
        materializeSlide({ type: "content", title: "Inserted", body: [] }),
        1,
      );
    const state = useDeckStore.getState();
    expect(state.deck.slides.map((slide) => slide.id)).toEqual([
      "a",
      id,
      "b",
      "c",
    ]);
  });

  it("updateSlide patches only the targeted slide", () => {
    useDeckStore.getState().updateSlide("b", { title: "Updated" });
    expect(titleOf("b")).toBe("Updated");
    expect(titleOf("a")).toBe("First");
    expect(titleOf("c")).toBe("Third");
  });

  it("updateSlide on a non-existent id is a no-op", () => {
    const before = useDeckStore.getState().deck.slides;
    useDeckStore.getState().updateSlide("does-not-exist", { title: "X" });
    expect(useDeckStore.getState().deck.slides).toEqual(before);
  });

  it("deleteSlide removes the slide and reselects a neighbor", () => {
    useDeckStore.getState().selectSlide("b");
    useDeckStore.getState().deleteSlide("b");
    const state = useDeckStore.getState();
    expect(state.deck.slides.map((slide) => slide.id)).toEqual(["a", "c"]);
    expect(state.selectedSlideId).toBe("c");
  });

  it("deleteSlide leaves selection null once every slide is gone", () => {
    useDeckStore.getState().deleteSlide("a");
    useDeckStore.getState().deleteSlide("b");
    useDeckStore.getState().deleteSlide("c");
    const state = useDeckStore.getState();
    expect(state.deck.slides).toHaveLength(0);
    expect(state.selectedSlideId).toBeNull();
  });

  it("reorderSlides applies a valid permutation", () => {
    useDeckStore.getState().reorderSlides(["c", "a", "b"]);
    expect(
      useDeckStore.getState().deck.slides.map((slide) => slide.id),
    ).toEqual(["c", "a", "b"]);
  });

  it("reorderSlides to the same order is a no-op", () => {
    useDeckStore.getState().reorderSlides(["a", "b", "c"]);
    expect(
      useDeckStore.getState().deck.slides.map((slide) => slide.id),
    ).toEqual(["a", "b", "c"]);
  });

  it("reorderSlides ignores an invalid permutation", () => {
    const before = useDeckStore.getState().deck.slides.map((slide) => slide.id);
    useDeckStore.getState().reorderSlides(["a", "b"]);
    expect(
      useDeckStore.getState().deck.slides.map((slide) => slide.id),
    ).toEqual(before);
  });

  it.each([
    ["duplicated", ["a", "a", "b"]],
    ["unknown", ["a", "b", "zzz"]],
  ])(
    "reorderSlides ignores a list with %s ids and adds no undo step",
    (_label, ids) => {
      const before = useDeckStore.getState().deck.slides.map((s) => s.id);
      const undoDepth = useDeckStore.getState().history.undoStack.length;
      useDeckStore.getState().reorderSlides(ids);
      expect(useDeckStore.getState().deck.slides.map((s) => s.id)).toEqual(
        before,
      );
      expect(useDeckStore.getState().history.undoStack.length).toBe(undoDepth);
    },
  );

  it("changeLayout updates type and merges layout hints incrementally", () => {
    useDeckStore.getState().changeLayout("b", {
      type: "two-column",
      layout: { columnTitles: ["Left"] },
    });
    useDeckStore
      .getState()
      .changeLayout("b", { layout: { columnTitles: ["Left", "Right"] } });
    const slide = slideById("b");
    expect(slide.type).toBe("two-column");
    expect(getSlideContent(slide).layout).toEqual({
      columnTitles: ["Left", "Right"],
    });
    expect(
      slide.elements.filter((el) => el.role === "column-title"),
    ).toHaveLength(2);
  });

  it("loadDeck replaces the deck and selects the first slide", () => {
    const newDeck = makeDeck();
    newDeck.id = "deck-2";
    useDeckStore.getState().loadDeck(newDeck);
    const state = useDeckStore.getState();
    expect(state.deck.id).toBe("deck-2");
    expect(state.selectedSlideId).toBe(newDeck.slides[0].id);
  });

  it("persists the deck to localStorage after a mutation", () => {
    vi.useFakeTimers();
    try {
      useDeckStore.getState().updateSlide("a", { title: "Persisted Title" });
      // Writes are debounced (see store/debouncedStorage.ts) - advance past
      // the delay so the pending write actually lands.
      vi.runAllTimers();

      const raw = localStorage.getItem("deck-lab:deck");
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw as string);
      expect(
        getSlideTitle(
          parsed.state.deck.slides.find(
            (slide: { id: string }) => slide.id === "a",
          ),
        ),
      ).toBe("Persisted Title");
    } finally {
      vi.useRealTimers();
    }
  });

  it("rehydrates in-memory state from localStorage via persist.rehydrate()", async () => {
    const persistedDeck = materializeDeck({
      id: "deck-1",
      title: "Test Deck",
      slides: [{ ...LEGACY_SLIDES[0], title: "From A Previous Session" }],
    });
    localStorage.setItem(
      "deck-lab:deck",
      JSON.stringify({
        state: { deck: persistedDeck, selectedSlideId: "a" },
        version: 1,
      }),
    );

    await useDeckStore.persist.rehydrate();

    expect(titleOf("a")).toBe("From A Previous Session");
  });

  it("migrates a deck saved before the element model (v0) into elements", async () => {
    localStorage.setItem(
      "deck-lab:deck",
      JSON.stringify({
        state: {
          deck: {
            id: "old-deck",
            title: "Old Deck",
            slides: [
              { id: "a", type: "title", title: "Old Title", body: [] },
              {
                id: "b",
                type: "two-column",
                title: "Old Columns",
                layout: { columnTitles: ["L", "R"] },
                body: [
                  { type: "bullets", items: ["left"], column: 0 },
                  { type: "paragraph", text: "right", column: 1 },
                ],
              },
            ],
          },
          selectedSlideId: "b",
        },
        version: 0,
      }),
    );

    await useDeckStore.persist.rehydrate();

    const state = useDeckStore.getState();
    expect(state.deck.id).toBe("old-deck");
    expect(state.selectedSlideId).toBe("b");
    expect(titleOf("a")).toBe("Old Title");
    const migrated = getSlideContent(slideById("b"));
    expect(migrated.layout).toEqual({ columnTitles: ["L", "R"] });
    expect(migrated.body).toEqual([
      { type: "bullets", items: ["left"], column: 0 },
      { type: "paragraph", text: "right", column: 1 },
    ]);
    expect(slideById("b").elements.length).toBeGreaterThan(0);
  });

  describe("element selection and manipulation", () => {
    const bodyOf = (id: string) =>
      slideById(id).elements.find((el) => el.role === "title")!;

    it("selectElement sets it, and switching slides clears it", () => {
      const el = bodyOf("a");
      useDeckStore.getState().selectElement(el.id);
      expect(useDeckStore.getState().selectedElementId).toBe(el.id);
      useDeckStore.getState().selectSlide("b");
      expect(useDeckStore.getState().selectedElementId).toBeNull();
    });

    it("setElementFrame moves an element as one undoable step", () => {
      const el = bodyOf("b");
      const frame = { x: 10, y: 20, w: 300, h: 90 };
      useDeckStore.getState().setElementFrame("b", el.id, frame);
      expect(bodyOf("b").frame).toEqual(frame);
      expect(useDeckStore.getState().history.undoStack).toHaveLength(1);
      useDeckStore.getState().undo();
      expect(bodyOf("b").frame).toEqual(el.frame);
    });

    it("deleteElement removes it and clears the selection", () => {
      const el = bodyOf("b");
      useDeckStore.getState().selectElement(el.id);
      useDeckStore.getState().deleteElement("b", el.id);
      expect(slideById("b").elements.some((e) => e.id === el.id)).toBe(false);
      expect(useDeckStore.getState().selectedElementId).toBeNull();
    });

    it("reorderElement changes stacking order; a no-op move adds no history", () => {
      const slide = slideById("a");
      const first = slide.elements[0];
      useDeckStore.getState().reorderElement("a", first.id, "front");
      expect(slideById("a").elements.at(-1)!.id).toBe(first.id);
      const before = useDeckStore.getState().history.undoStack.length;
      useDeckStore.getState().reorderElement("a", first.id, "front");
      expect(useDeckStore.getState().history.undoStack).toHaveLength(before);
    });

    it("addElement appends on top and selects it", () => {
      const element = createDefaultElement("text");
      useDeckStore.getState().addElement("c", element);
      expect(slideById("c").elements.at(-1)!.id).toBe(element.id);
      expect(useDeckStore.getState().selectedElementId).toBe(element.id);
      expect(useDeckStore.getState().selectedSlideId).toBe("c");
    });

    it("updateElementStyle merges, and an undefined value clears a field", () => {
      const el = bodyOf("b");
      useDeckStore
        .getState()
        .updateElementStyle("b", el.id, { italic: true, color: "#ff0000" });
      expect(bodyOf("b").style).toMatchObject({
        italic: true,
        color: "#ff0000",
      });
      useDeckStore
        .getState()
        .updateElementStyle("b", el.id, { italic: undefined });
      expect(bodyOf("b").style).not.toHaveProperty("italic");
      expect(bodyOf("b").style?.color).toBe("#ff0000");
    });

    it("an AI body rewrite keeps a manually moved title where the user put it", () => {
      const el = bodyOf("b");
      const moved = { x: 900, y: 700, w: 500, h: 80 };
      useDeckStore.getState().setElementFrame("b", el.id, moved);
      useDeckStore.getState().updateSlide("b", {
        body: [{ type: "paragraph", text: "Rewritten" }],
      });
      expect(bodyOf("b").frame).toEqual(moved);
      expect(getSlideContent(slideById("b")).body).toEqual([
        { type: "paragraph", text: "Rewritten" },
      ]);
    });
  });

  describe("updateElement", () => {
    it("replaces one element's content and leaves its frame alone", () => {
      const title = slideById("b").elements.find((el) => el.role === "title")!;
      useDeckStore
        .getState()
        .updateElement("b", title.id, { type: "text", text: "Typed" });
      const after = slideById("b").elements.find((el) => el.id === title.id)!;
      expect(after.content).toEqual({ type: "text", text: "Typed" });
      expect(after.frame).toEqual(title.frame);
      expect(titleOf("a")).toBe("First");
    });

    it("is undoable like any other edit", () => {
      const title = slideById("b").elements.find((el) => el.role === "title")!;
      useDeckStore
        .getState()
        .updateElement("b", title.id, { type: "text", text: "Typed" });
      useDeckStore.getState().undo();
      expect(titleOf("b")).toBe("Second");
    });

    it("is a no-op for an unknown slide or element id", () => {
      const before = useDeckStore.getState().deck;
      useDeckStore
        .getState()
        .updateElement("b", "nope", { type: "text", text: "X" });
      useDeckStore
        .getState()
        .updateElement("nope", "nope", { type: "text", text: "X" });
      expect(useDeckStore.getState().deck).toBe(before);
      expect(useDeckStore.getState().history.undoStack).toHaveLength(0);
    });
  });

  describe("setSlideTheme", () => {
    it("updates slideTheme", () => {
      useDeckStore.getState().setSlideTheme("dark");
      expect(useDeckStore.getState().slideTheme).toBe("dark");
    });

    it("is not part of undo/redo history", () => {
      useDeckStore.getState().setSlideTheme("dark");
      expect(useDeckStore.getState().history.undoStack).toHaveLength(0);
    });

    it("persists to localStorage after a change", () => {
      vi.useFakeTimers();
      try {
        useDeckStore.getState().setSlideTheme("dark");
        // Writes are debounced (see store/debouncedStorage.ts) - advance
        // past the delay so the pending write actually lands.
        vi.runAllTimers();

        const raw = localStorage.getItem("deck-lab:deck");
        const parsed = JSON.parse(raw as string);
        expect(parsed.state.slideTheme).toBe("dark");
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("undo/redo", () => {
    it("undo restores a slide's prior text after a manual-style edit", () => {
      useDeckStore.getState().updateSlide("a", { title: "Edited" });
      expect(titleOf("a")).toBe("Edited");

      useDeckStore.getState().undo();

      expect(titleOf("a")).toBe("First");
    });

    it("undo removes a slide added via the same action an AI tool call uses, and redo brings it back", () => {
      const id = useDeckStore
        .getState()
        .addSlide(
          materializeSlide({ type: "content", title: "AI Added", body: [] }),
        );
      expect(useDeckStore.getState().deck.slides.map((s) => s.id)).toContain(
        id,
      );

      useDeckStore.getState().undo();
      expect(
        useDeckStore.getState().deck.slides.map((s) => s.id),
      ).not.toContain(id);

      useDeckStore.getState().redo();
      expect(useDeckStore.getState().deck.slides.map((s) => s.id)).toContain(
        id,
      );
    });

    it("undoes an interleaved sequence of manual and AI-style actions in true chronological order", () => {
      // "manual" edit
      useDeckStore.getState().updateSlide("a", { title: "Manual Edit" });
      // "AI" tool call
      useDeckStore.getState().deleteSlide("b");
      // "manual" edit again
      useDeckStore.getState().updateSlide("c", { title: "Manual Edit 2" });

      expect(useDeckStore.getState().deck.slides.map(getSlideTitle)).toEqual([
        "Manual Edit",
        "Manual Edit 2",
      ]);

      useDeckStore.getState().undo(); // undo "Manual Edit 2"
      expect(useDeckStore.getState().deck.slides.map(getSlideTitle)).toEqual([
        "Manual Edit",
        "Third",
      ]);

      useDeckStore.getState().undo(); // undo the delete
      expect(useDeckStore.getState().deck.slides.map(getSlideTitle)).toEqual([
        "Manual Edit",
        "Second",
        "Third",
      ]);

      useDeckStore.getState().undo(); // undo "Manual Edit"
      expect(useDeckStore.getState().deck.slides.map(getSlideTitle)).toEqual([
        "First",
        "Second",
        "Third",
      ]);

      expect(useDeckStore.getState().history.undoStack).toHaveLength(0);
    });

    it("undo on an empty history is a no-op", () => {
      const before = useDeckStore.getState().deck;
      useDeckStore.getState().undo();
      expect(useDeckStore.getState().deck).toBe(before);
    });

    it("redo on an empty redo stack is a no-op", () => {
      useDeckStore.getState().updateSlide("a", { title: "Edited" });
      const before = useDeckStore.getState().deck;
      useDeckStore.getState().redo();
      expect(useDeckStore.getState().deck).toBe(before);
    });

    it("a new action after an undo discards the redo branch", () => {
      useDeckStore.getState().updateSlide("a", { title: "First Edit" });
      useDeckStore.getState().undo();
      expect(useDeckStore.getState().history.redoStack).toHaveLength(1);

      useDeckStore.getState().updateSlide("a", { title: "Different Edit" });

      expect(useDeckStore.getState().history.redoStack).toHaveLength(0);
      useDeckStore.getState().redo(); // no-op, nothing to redo
      expect(titleOf("a")).toBe("Different Edit");
    });

    it("undo/redo do not touch selection-only changes (selectSlide isn't part of history)", () => {
      useDeckStore.getState().selectSlide("c");
      useDeckStore.getState().updateSlide("a", { title: "Edited" });
      useDeckStore.getState().selectSlide("b");

      useDeckStore.getState().undo();

      // The undo point captured before updateSlide had selection "c", not
      // the later "b" - selecting afterward doesn't create its own step.
      expect(useDeckStore.getState().selectedSlideId).toBe("c");
      expect(titleOf("a")).toBe("First");
    });
  });
});
