import { describe, expect, it } from "vitest";
import { DECK_GENERATION_SYSTEM_PROMPT as prompt } from "./generateDeck";

describe("DECK_GENERATION_SYSTEM_PROMPT", () => {
  it("makes a requested slide count, in digits or words, win over the default structure", () => {
    expect(prompt).toMatch(/must have exactly that many/);
    expect(prompt).toMatch(/"five slides"/);
    expect(prompt).not.toMatch(/always wins over/);
  });

  it("keeps the structure required, and never relaxed by a count of 4 or more", () => {
    expect(prompt).toMatch(
      /Required deck structure - every deck you generate must follow/,
    );
    expect(prompt).toMatch(/a requested count of 4 or more never relaxes it/);
    expect(prompt).toMatch(
      /Only for a requested count under 4, drop parts in this order/,
    );
  });

  it("defines which structural parts are dropped first for decks under 4 slides", () => {
    expect(prompt).toMatch(/3 slides: drop the closing slide/);
    expect(prompt).toMatch(/2 slides: also drop the image slide/);
    expect(prompt).toMatch(/1 slide: also drop the chart slide/);
  });

  it("captions invented chart figures as illustrative, but not user-supplied data", () => {
    expect(prompt).toMatch(/"Illustrative figures"/);
    expect(prompt).toMatch(
      /use their figures exactly and do not call them illustrative/,
    );
  });
});
