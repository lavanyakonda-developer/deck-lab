import { describe, expect, it } from "vitest";
import { TOOL_DEFINITIONS, validateToolCall } from "./tools";

describe("TOOL_DEFINITIONS", () => {
  it("defines generate_deck plus the five spec'd editing tools", () => {
    const names = TOOL_DEFINITIONS.map((tool) => tool.function.name);
    expect(names).toEqual([
      "generate_deck",
      "add_slide",
      "update_slide",
      "delete_slide",
      "reorder_slides",
      "change_layout",
    ]);
  });

  it("marks every tool as strict", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.function.strict).toBe(true);
    }
  });
});

describe("validateToolCall", () => {
  it("returns null for an unknown tool name", () => {
    expect(validateToolCall("delete_deck", { id: "x" })).toBeNull();
  });

  it("validates a well-formed generate_deck call", () => {
    expect(
      validateToolCall("generate_deck", {
        prompt: "Create a 5-slide deck on our Q3 roadmap",
      }),
    ).toEqual({
      tool: "generate_deck",
      args: { prompt: "Create a 5-slide deck on our Q3 roadmap" },
    });
  });

  it("rejects a generate_deck call with an empty prompt", () => {
    expect(validateToolCall("generate_deck", { prompt: "" })).toBeNull();
  });

  it("validates a well-formed add_slide call", () => {
    const result = validateToolCall("add_slide", {
      slide: {
        type: "content",
        title: "Pricing",
        subtitle: null,
        body: [{ type: "bullets", items: ["Free", "Pro"], column: null }],
        layout: null,
      },
      index: 2,
    });
    expect(result).toEqual({
      tool: "add_slide",
      args: {
        slide: {
          type: "content",
          title: "Pricing",
          subtitle: null,
          body: [{ type: "bullets", items: ["Free", "Pro"], column: null }],
          layout: null,
        },
        index: 2,
      },
    });
  });

  it("rejects an add_slide call with an invalid slide type", () => {
    const result = validateToolCall("add_slide", {
      slide: {
        type: "banner",
        title: "X",
        subtitle: null,
        body: [],
        layout: null,
      },
      index: null,
    });
    expect(result).toBeNull();
  });

  it("validates a well-formed update_slide call with partial nulls", () => {
    const result = validateToolCall("update_slide", {
      id: "slide-3",
      title: "Shorter Title",
      subtitle: null,
      body: null,
      layout: null,
    });
    expect(result).toEqual({
      tool: "update_slide",
      args: {
        id: "slide-3",
        title: "Shorter Title",
        subtitle: null,
        body: null,
        layout: null,
      },
    });
  });

  it("rejects an update_slide call missing a required field", () => {
    const result = validateToolCall("update_slide", {
      id: "slide-3",
      title: null,
      // subtitle omitted entirely
      body: null,
      layout: null,
    });
    expect(result).toBeNull();
  });

  it("validates a well-formed delete_slide call", () => {
    expect(validateToolCall("delete_slide", { id: "slide-2" })).toEqual({
      tool: "delete_slide",
      args: { id: "slide-2" },
    });
  });

  it("validates a well-formed reorder_slides call", () => {
    expect(
      validateToolCall("reorder_slides", { orderedIds: ["a", "b", "c"] }),
    ).toEqual({
      tool: "reorder_slides",
      args: { orderedIds: ["a", "b", "c"] },
    });
  });

  it("rejects a reorder_slides call with an empty list", () => {
    expect(validateToolCall("reorder_slides", { orderedIds: [] })).toBeNull();
  });

  it("validates a well-formed change_layout call", () => {
    const result = validateToolCall("change_layout", {
      id: "slide-2",
      type: "table",
      layout: null,
    });
    expect(result).toEqual({
      tool: "change_layout",
      args: { id: "slide-2", type: "table", layout: null },
    });
  });

  it("rejects a change_layout call with an invalid type", () => {
    const result = validateToolCall("change_layout", {
      id: "slide-2",
      type: "banner",
      layout: null,
    });
    expect(result).toBeNull();
  });
});
