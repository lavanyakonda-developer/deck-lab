import { describe, expect, it } from "vitest";
import { seedDeck } from "@/lib/seedDeck";
import { applyChatEvents } from "./applyEvents";
import { loadEditCases, scoreEditRun, type EditCase } from "./editCases";
import type { SSEResult, TimedEvent } from "./sse";

function response(...events: Array<[string, unknown]>): SSEResult {
  const timed: TimedEvent[] = events.map(([event, data], i) => ({
    event,
    data,
    t: (i + 1) * 100,
  }));
  return { status: 200, events: timed, totalMs: timed.length * 100 };
}

function score(testCase: EditCase, result: SSEResult) {
  const after = applyChatEvents(seedDeck, result.events);
  return scoreEditRun(testCase, seedDeck, result, after);
}

const updateArgs = (id: string, title: string) => ({
  id,
  title,
  subtitle: null,
  body: null,
  layout: null,
});

const retitle3: EditCase = {
  id: "t",
  category: "c",
  message: "Change slide 3's title",
  expect: { tools: [{ tool: "update_slide", slideId: "slide-3" }] },
};

describe("scoreEditRun", () => {
  it("passes a correct, targeted edit", () => {
    const s = score(
      retitle3,
      response(
        [
          "tool-call",
          { tool: "update_slide", args: updateArgs("slide-3", "X") },
        ],
        ["done", { reply: "Done" }],
      ),
    );
    expect(s).toMatchObject({
      toolCorrect: true,
      targetCorrect: true,
      preserved: true,
      answeredInText: false,
      invalidCall: false,
      passed: true,
      latencyMs: 200,
    });
  });

  it("flags the right tool on the wrong slide, and the slide it damaged", () => {
    const s = score(
      retitle3,
      response(
        [
          "tool-call",
          { tool: "update_slide", args: updateArgs("slide-4", "X") },
        ],
        ["done", { reply: "Done" }],
      ),
    );
    expect(s).toMatchObject({
      toolCorrect: true,
      targetCorrect: false,
      preserved: false,
      passed: false,
    });
    expect(s.problems.join(" ")).toContain(
      "changed untargeted slides: slide-4",
    );
  });

  it("counts a response with no tool call as answered in text, with preservation not applicable", () => {
    const s = score(retitle3, response(["done", { reply: "Sure!" }]));
    expect(s).toMatchObject({
      toolCorrect: false,
      answeredInText: true,
      invalidCall: false,
      preserved: undefined,
      passed: false,
    });
  });

  it("separates a rejected tool call from answering in text", () => {
    const s = score(
      retitle3,
      response(
        ["invalid-tool-call", { tool: "update_slide", error: "id: Required" }],
        ["done", { reply: "I didn't make any changes." }],
      ),
    );
    expect(s).toMatchObject({
      answeredInText: false,
      invalidCall: true,
      invalidCalls: ["update_slide: id: Required"],
      passed: false,
    });
  });

  it("counts an error event as a failure, not a miss", () => {
    const s = score(retitle3, response(["error", { error: "boom" }]));
    expect(s).toMatchObject({
      error: "boom",
      answeredInText: false,
      invalidCall: false,
      passed: false,
    });
  });

  it("allows optional calls but rejects unexpected ones", () => {
    const testCase: EditCase = {
      ...retitle3,
      expect: {
        tools: [{ tool: "change_layout", slideId: "slide-3" }],
        optional: [{ tool: "update_slide", slideId: "slide-3" }],
      },
    };
    const layout = {
      tool: "change_layout",
      args: { id: "slide-3", type: "two-column", layout: null },
    };
    const withOptional = score(
      testCase,
      response(
        ["tool-call", layout],
        [
          "tool-call",
          { tool: "update_slide", args: updateArgs("slide-3", "X") },
        ],
        ["done", { reply: "Done" }],
      ),
    );
    expect(withOptional.passed).toBe(true);

    const withExtra = score(
      testCase,
      response(
        ["tool-call", layout],
        ["tool-call", { tool: "delete_slide", args: { id: "slide-5" } }],
        ["done", { reply: "Done" }],
      ),
    );
    expect(withExtra).toMatchObject({ toolCorrect: false, passed: false });
  });

  it("checks add_slide by where the new slide ends up", () => {
    const testCase: EditCase = {
      ...retitle3,
      expect: { tools: [{ tool: "add_slide", position: 4 }] },
    };
    const add = (index: number | null) =>
      response(
        [
          "tool-call",
          {
            tool: "add_slide",
            args: {
              slide: {
                type: "content",
                title: "Pricing",
                subtitle: null,
                body: [],
                layout: null,
              },
              index,
            },
          },
        ],
        ["done", { reply: "Done" }],
      );
    expect(score(testCase, add(3)).passed).toBe(true);
    expect(score(testCase, add(null)).targetCorrect).toBe(false);
  });

  it("checks reorder_slides by the resulting order", () => {
    const order = [
      "slide-1",
      "slide-3",
      "slide-2",
      "slide-4",
      "slide-5",
      "slide-6",
    ];
    const testCase: EditCase = {
      ...retitle3,
      expect: { tools: [{ tool: "reorder_slides", order }] },
    };
    const s = score(
      testCase,
      response(
        ["tool-call", { tool: "reorder_slides", args: { orderedIds: order } }],
        ["done", { reply: "Done" }],
      ),
    );
    expect(s.passed).toBe(true);
  });

  it("checks the resulting content when the case requires a block type", () => {
    const testCase: EditCase = {
      ...retitle3,
      expect: {
        tools: [{ tool: "update_slide", slideId: "slide-2" }],
        resultHasBlock: { slideId: "slide-2", type: "table" },
      },
    };
    const stillBullets = score(
      testCase,
      response(
        [
          "tool-call",
          { tool: "update_slide", args: updateArgs("slide-2", "X") },
        ],
        ["done", { reply: "Done" }],
      ),
    );
    expect(stillBullets.targetCorrect).toBe(false);

    const table = score(
      testCase,
      response(
        [
          "tool-call",
          {
            tool: "update_slide",
            args: {
              ...updateArgs("slide-2", "X"),
              title: null,
              body: [
                { type: "table", headers: ["A"], rows: [["1"]], column: null },
              ],
            },
          },
        ],
        ["done", { reply: "Done" }],
      ),
    );
    expect(table.passed).toBe(true);
  });

  it("treats a generated deck as a (wrong) generate_deck call that destroyed the deck", () => {
    const s = score(
      retitle3,
      response([
        "done",
        {
          reply: "Generated",
          generatedDeck: { ...seedDeck, id: "new", slides: [] },
        },
      ]),
    );
    expect(s.calls).toEqual(["generate_deck"]);
    expect(s).toMatchObject({ toolCorrect: false, preserved: false });
  });

  describe("clarify cases", () => {
    const ambiguous: EditCase = {
      id: "a",
      category: "c",
      message: "Make it better",
      expect: { clarify: true },
    };

    it("passes when the reply asks a question and nothing changed", () => {
      const s = score(ambiguous, response(["done", { reply: "Which slide?" }]));
      expect(s).toMatchObject({
        kind: "clarify",
        clarifyCorrect: true,
        passed: true,
      });
    });

    it("fails when it edits instead of asking", () => {
      const s = score(
        ambiguous,
        response(
          [
            "tool-call",
            { tool: "update_slide", args: updateArgs("slide-2", "X") },
          ],
          ["done", { reply: "Done?" }],
        ),
      );
      expect(s.clarifyCorrect).toBe(false);
    });
  });
});

describe("edit-cases.json", () => {
  it("parses, has unique ids, and only targets slides in the seed deck", () => {
    const cases = loadEditCases();
    expect(cases.length).toBeGreaterThanOrEqual(40);
    const seedIds = new Set(seedDeck.slides.map((s) => s.id));
    for (const c of cases) {
      if (c.selectedSlideId) expect(seedIds).toContain(c.selectedSlideId);
      if ("clarify" in c.expect) continue;
      for (const call of [...c.expect.tools, ...(c.expect.optional ?? [])]) {
        if (call.slideId) expect(seedIds).toContain(call.slideId);
        for (const id of call.order ?? []) expect(seedIds).toContain(id);
      }
    }
  });
});
