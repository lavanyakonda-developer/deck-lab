import { describe, expect, it, vi } from "vitest";
import { applyToolCall, applyToolCalls } from "./applyToolCalls";
import type { ValidatedToolCall } from "./tools";

function makeActions() {
  return {
    addSlide: vi.fn().mockReturnValue("new-id"),
    updateSlide: vi.fn(),
    deleteSlide: vi.fn(),
    reorderSlides: vi.fn(),
    changeLayout: vi.fn(),
  };
}

describe("applyToolCall", () => {
  it("generate_deck is a no-op (should be intercepted server-side, never reach here)", () => {
    const actions = makeActions();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    applyToolCall(actions, {
      tool: "generate_deck",
      args: { prompt: "Create a deck" },
    });

    expect(actions.addSlide).not.toHaveBeenCalled();
    expect(actions.updateSlide).not.toHaveBeenCalled();
    expect(actions.deleteSlide).not.toHaveBeenCalled();
    expect(actions.reorderSlides).not.toHaveBeenCalled();
    expect(actions.changeLayout).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("add_slide calls addSlide with a normalized slide and the given index", () => {
    const actions = makeActions();
    const call: ValidatedToolCall = {
      tool: "add_slide",
      args: {
        slide: {
          type: "content",
          title: "Pricing",
          subtitle: null,
          body: [{ type: "bullets", items: ["Free", "Pro"], column: null }],
          layout: null,
          speakerNotes: "",
        },
        index: 2,
      },
    };

    applyToolCall(actions, call);

    expect(actions.addSlide).toHaveBeenCalledWith(
      {
        type: "content",
        title: "Pricing",
        subtitle: undefined,
        body: [{ type: "bullets", items: ["Free", "Pro"], column: undefined }],
        layout: undefined,
        speakerNotes: "",
      },
      2,
    );
  });

  it("update_slide only includes non-null fields in the patch", () => {
    const actions = makeActions();
    const call: ValidatedToolCall = {
      tool: "update_slide",
      args: {
        id: "slide-3",
        title: "Shorter Title",
        subtitle: null,
        body: null,
        layout: null,
        speakerNotes: null,
      },
    };

    applyToolCall(actions, call);

    expect(actions.updateSlide).toHaveBeenCalledWith("slide-3", {
      title: "Shorter Title",
    });
  });

  it("update_slide passes a normalized body when provided", () => {
    const actions = makeActions();
    const call: ValidatedToolCall = {
      tool: "update_slide",
      args: {
        id: "slide-2",
        title: null,
        subtitle: null,
        body: [{ type: "paragraph", text: "New text", column: null }],
        layout: null,
        speakerNotes: null,
      },
    };

    applyToolCall(actions, call);

    expect(actions.updateSlide).toHaveBeenCalledWith("slide-2", {
      body: [{ type: "paragraph", text: "New text", column: undefined }],
    });
  });

  it("delete_slide calls deleteSlide with the given id", () => {
    const actions = makeActions();
    applyToolCall(actions, { tool: "delete_slide", args: { id: "slide-2" } });
    expect(actions.deleteSlide).toHaveBeenCalledWith("slide-2");
  });

  it("reorder_slides calls reorderSlides with the given order", () => {
    const actions = makeActions();
    applyToolCall(actions, {
      tool: "reorder_slides",
      args: { orderedIds: ["c", "a", "b"] },
    });
    expect(actions.reorderSlides).toHaveBeenCalledWith(["c", "a", "b"]);
  });

  it("change_layout maps null type/layout to undefined", () => {
    const actions = makeActions();
    applyToolCall(actions, {
      tool: "change_layout",
      args: { id: "slide-2", type: "table", layout: null },
    });
    expect(actions.changeLayout).toHaveBeenCalledWith("slide-2", {
      type: "table",
      layout: undefined,
    });
  });
});

describe("applyToolCalls", () => {
  it("applies multiple tool calls in order and touches only the targeted actions", () => {
    const actions = makeActions();
    applyToolCalls(actions, [
      {
        tool: "update_slide",
        args: {
          id: "a",
          title: "X",
          subtitle: null,
          body: null,
          layout: null,
          speakerNotes: null,
        },
      },
      { tool: "delete_slide", args: { id: "b" } },
    ]);

    expect(actions.updateSlide).toHaveBeenCalledTimes(1);
    expect(actions.deleteSlide).toHaveBeenCalledTimes(1);
    expect(actions.addSlide).not.toHaveBeenCalled();
    expect(actions.reorderSlides).not.toHaveBeenCalled();
    expect(actions.changeLayout).not.toHaveBeenCalled();
  });
});
