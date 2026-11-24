import { describe, expect, it } from "vitest";
import { claimedSelection } from "./inventedSelection";

describe("claimedSelection", () => {
  it.each([
    [
      "Currently, slide 2 is shown as selected. Would you like to update it?",
      "shown as selected",
    ],
    [
      'It looks like slide 2 ("What This Deck Demonstrates") is currently selected.',
      "currently selected",
    ],
    [
      "If you are referring to the currently selected slide, it is slide 6.",
      "currently selected",
    ],
    ["Should I apply this to the selected slide?", "the selected slide"],
    [
      'You\'re viewing slide 2, titled "What This Deck Demonstrates".',
      "You're viewing slide",
    ],
    ["Is that the slide you have selected?", "slide you have selected"],
  ])("flags %j", (reply, phrase) => {
    expect(claimedSelection(reply)).toBe(phrase);
  });

  it.each([
    "Which slide do you mean?",
    "Please select which slide you'd like to change, or tell me its number.",
    "You can select a different layout from the toolbar afterwards.",
    "I selected the most important points for the summary.",
    "Could you specify which slide you would like to add more detail to?",
    "Done — updated a slide.",
  ])("does not flag an unrelated mention: %j", (reply) => {
    expect(claimedSelection(reply)).toBeUndefined();
  });
});
