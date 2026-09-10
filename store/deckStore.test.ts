import { beforeEach, describe, expect, it } from "vitest";
import type { Deck } from "@/lib/schema/slide";
import { useDeckStore } from "./deckStore";
import { createHistoryState } from "./historyMiddleware";

function makeDeck(): Deck {
  return {
    id: "deck-1",
    title: "Test Deck",
    slides: [
      { id: "a", type: "title", title: "First", body: [] },
      { id: "b", type: "content", title: "Second", body: [] },
      { id: "c", type: "content", title: "Third", body: [] },
    ],
  };
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
    const id = useDeckStore.getState().addSlide({
      type: "content",
      title: "New Slide",
      body: [],
    });
    const state = useDeckStore.getState();
    expect(state.deck.slides).toHaveLength(4);
    expect(state.deck.slides[3].id).toBe(id);
    expect(state.selectedSlideId).toBe(id);
  });

  it("addSlide inserts at a specific index", () => {
    const id = useDeckStore
      .getState()
      .addSlide({ type: "content", title: "Inserted", body: [] }, 1);
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
    const state = useDeckStore.getState();
    expect(state.deck.slides.find((slide) => slide.id === "b")?.title).toBe(
      "Updated",
    );
    expect(state.deck.slides.find((slide) => slide.id === "a")?.title).toBe(
      "First",
    );
    expect(state.deck.slides.find((slide) => slide.id === "c")?.title).toBe(
      "Third",
    );
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

  it("changeLayout updates type and merges layout hints incrementally", () => {
    useDeckStore
      .getState()
      .changeLayout("b", { type: "two-column", layout: { columns: 2 } });
    useDeckStore
      .getState()
      .changeLayout("b", { layout: { columnTitles: ["Left", "Right"] } });
    const slide = useDeckStore.getState().deck.slides.find((s) => s.id === "b");
    expect(slide?.type).toBe("two-column");
    expect(slide?.layout).toEqual({
      columns: 2,
      columnTitles: ["Left", "Right"],
    });
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
    useDeckStore.getState().updateSlide("a", { title: "Persisted Title" });
    const raw = localStorage.getItem("deck-lab:deck");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(
      parsed.state.deck.slides.find((slide: { id: string }) => slide.id === "a")
        .title,
    ).toBe("Persisted Title");
  });

  it("rehydrates in-memory state from localStorage via persist.rehydrate()", async () => {
    const persistedDeck = makeDeck();
    persistedDeck.slides[0].title = "From A Previous Session";
    localStorage.setItem(
      "deck-lab:deck",
      JSON.stringify({
        state: { deck: persistedDeck, selectedSlideId: "a" },
        version: 0,
      }),
    );

    await useDeckStore.persist.rehydrate();

    expect(
      useDeckStore.getState().deck.slides.find((slide) => slide.id === "a")
        ?.title,
    ).toBe("From A Previous Session");
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
      useDeckStore.getState().setSlideTheme("dark");
      const raw = localStorage.getItem("deck-lab:deck");
      const parsed = JSON.parse(raw as string);
      expect(parsed.state.slideTheme).toBe("dark");
    });
  });

  describe("undo/redo", () => {
    it("undo restores a slide's prior text after a manual-style edit", () => {
      useDeckStore.getState().updateSlide("a", { title: "Edited" });
      expect(
        useDeckStore.getState().deck.slides.find((s) => s.id === "a")?.title,
      ).toBe("Edited");

      useDeckStore.getState().undo();

      expect(
        useDeckStore.getState().deck.slides.find((s) => s.id === "a")?.title,
      ).toBe("First");
    });

    it("undo removes a slide added via the same action an AI tool call uses, and redo brings it back", () => {
      const id = useDeckStore.getState().addSlide({
        type: "content",
        title: "AI Added",
        body: [],
      });
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

      expect(useDeckStore.getState().deck.slides.map((s) => s.title)).toEqual([
        "Manual Edit",
        "Manual Edit 2",
      ]);

      useDeckStore.getState().undo(); // undo "Manual Edit 2"
      expect(useDeckStore.getState().deck.slides.map((s) => s.title)).toEqual([
        "Manual Edit",
        "Third",
      ]);

      useDeckStore.getState().undo(); // undo the delete
      expect(useDeckStore.getState().deck.slides.map((s) => s.title)).toEqual([
        "Manual Edit",
        "Second",
        "Third",
      ]);

      useDeckStore.getState().undo(); // undo "Manual Edit"
      expect(useDeckStore.getState().deck.slides.map((s) => s.title)).toEqual([
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
      expect(
        useDeckStore.getState().deck.slides.find((s) => s.id === "a")?.title,
      ).toBe("Different Edit");
    });

    it("undo/redo do not touch selection-only changes (selectSlide isn't part of history)", () => {
      useDeckStore.getState().selectSlide("c");
      useDeckStore.getState().updateSlide("a", { title: "Edited" });
      useDeckStore.getState().selectSlide("b");

      useDeckStore.getState().undo();

      // The undo point captured before updateSlide had selection "c", not
      // the later "b" - selecting afterward doesn't create its own step.
      expect(useDeckStore.getState().selectedSlideId).toBe("c");
      expect(
        useDeckStore.getState().deck.slides.find((s) => s.id === "a")?.title,
      ).toBe("First");
    });
  });
});
