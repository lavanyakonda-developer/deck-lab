import { describe, expect, it } from "vitest";
import { seedDeck } from "@/lib/seedDeck";
import { getSlideTitle } from "@/lib/slides/layoutEngine";
import { applyChatEvents } from "./applyEvents";
import { changedNonTargetSlides } from "./compare";
import type { TimedEvent } from "./sse";

const event = (name: string, data: unknown): TimedEvent => ({
  event: name,
  data,
  t: 0,
});

describe("applyChatEvents", () => {
  it("applies tool calls through the deck store without mutating the input", () => {
    const before = structuredClone(seedDeck);
    const after = applyChatEvents(seedDeck, [
      event("tool-call", {
        tool: "update_slide",
        args: {
          id: "slide-3",
          title: "New Title",
          subtitle: null,
          body: null,
          layout: null,
        },
      }),
      event("done", { reply: "Done" }),
    ]);

    expect(getSlideTitle(after.slides[2])).toBe("New Title");
    expect(seedDeck).toEqual(before);
    expect(changedNonTargetSlides(seedDeck, after, ["slide-3"])).toEqual([]);
  });

  it("reports untargeted slides that changed or disappeared", () => {
    const after = applyChatEvents(seedDeck, [
      event("tool-call", { tool: "delete_slide", args: { id: "slide-2" } }),
    ]);
    expect(changedNonTargetSlides(seedDeck, after, [])).toEqual(["slide-2"]);
    expect(changedNonTargetSlides(seedDeck, after, ["slide-2"])).toEqual([]);
  });

  it("replaces the deck when the turn generated a new one", () => {
    const generatedDeck = { ...seedDeck, id: "new", slides: [] };
    const after = applyChatEvents(seedDeck, [
      event("done", { reply: "Generated", generatedDeck }),
    ]);
    expect(after.id).toBe("new");
    expect(after.slides).toHaveLength(0);
  });

  it("starts each call from the given deck, not the previous result", () => {
    applyChatEvents(seedDeck, [
      event("tool-call", { tool: "delete_slide", args: { id: "slide-2" } }),
    ]);
    const after = applyChatEvents(seedDeck, []);
    expect(after.slides).toHaveLength(seedDeck.slides.length);
  });
});
