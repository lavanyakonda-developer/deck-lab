import { describe, expect, it } from "vitest";
import {
  checkToolCall,
  dropEmptyContent,
  prepareToolArgs,
  TOOL_DEFINITIONS,
  validateToolCall,
} from "./tools";

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

describe("checkToolCall", () => {
  it("returns the validated call when the arguments are valid", () => {
    expect(checkToolCall("delete_slide", { id: "slide-2" })).toEqual({
      ok: true,
      call: { tool: "delete_slide", args: { id: "slide-2" } },
    });
  });

  it("explains why invalid arguments were rejected", () => {
    const result = checkToolCall("delete_slide", {});
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/^id: /);
  });

  it("rejects an unknown tool by name", () => {
    expect(checkToolCall("delete_deck", {})).toEqual({
      ok: false,
      error: 'unknown tool "delete_deck"',
    });
  });
});

describe("prepareToolArgs", () => {
  it("treats a missing nullable key on update_slide and change_layout as null", () => {
    const update = checkToolCall("update_slide", {
      id: "slide-2",
      title: "New",
      subtitle: null,
      body: null,
    });
    expect(update).toEqual({
      ok: true,
      call: {
        tool: "update_slide",
        args: {
          id: "slide-2",
          title: "New",
          subtitle: null,
          body: null,
          layout: null,
        },
      },
    });
    const layout = checkToolCall("change_layout", {
      id: "slide-2",
      type: "table",
    });
    expect(layout.ok && layout.call.args).toEqual({
      id: "slide-2",
      type: "table",
      layout: null,
    });
  });

  it("still rejects a missing required id", () => {
    expect(checkToolCall("update_slide", { title: "x" }).ok).toBe(false);
  });

  it("drops empty bullet items, then empty bullet blocks and empty paragraphs", () => {
    expect(
      dropEmptyContent([
        { type: "bullets", items: ["A", "", "  "] },
        { type: "bullets", items: [""] },
        { type: "paragraph", text: " " },
        { type: "paragraph", text: "Kept" },
        { type: "table", headers: ["A"], rows: [] },
      ]),
    ).toEqual([
      { type: "bullets", items: ["A"] },
      { type: "paragraph", text: "Kept" },
      { type: "table", headers: ["A"], rows: [] },
    ]);
  });

  it("accepts an update_slide whose body had an empty block, without it", () => {
    const result = checkToolCall("update_slide", {
      id: "slide-2",
      title: null,
      subtitle: null,
      body: [
        { type: "bullets", items: ["One", "Two"], column: null },
        { type: "paragraph", text: "", column: null },
      ],
      layout: null,
    });
    expect(result.ok).toBe(true);
    expect(
      result.ok && result.call.tool === "update_slide" && result.call.args.body,
    ).toHaveLength(1);
  });

  it("rejects an update_slide whose non-empty body would be emptied by cleaning, instead of wiping the slide", () => {
    const args = {
      id: "slide-2",
      title: null,
      subtitle: null,
      body: [
        { type: "bullets", items: [], column: null },
        { type: "paragraph", text: "", column: null },
      ],
      layout: null,
    };
    expect(prepareToolArgs("update_slide", args)).toEqual({
      error:
        "body: every block was empty; rejected instead of clearing the slide",
    });
    expect(checkToolCall("update_slide", args)).toEqual({
      ok: false,
      error:
        "body: every block was empty; rejected instead of clearing the slide",
    });
  });

  it("still accepts an explicitly empty update_slide body", () => {
    expect(
      checkToolCall("update_slide", {
        id: "slide-2",
        title: null,
        subtitle: null,
        body: [],
        layout: null,
      }).ok,
    ).toBe(true);
  });

  it("drops an empty bullets block from add_slide instead of rejecting the slide", () => {
    const result = checkToolCall("add_slide", {
      slide: {
        type: "content",
        title: "Pricing",
        subtitle: null,
        body: [{ type: "bullets", items: [], column: null }],
        layout: null,
      },
      index: 3,
    });
    expect(result.ok).toBe(true);
    expect(
      result.ok &&
        result.call.tool === "add_slide" &&
        result.call.args.slide.body,
    ).toEqual([]);
  });
});
