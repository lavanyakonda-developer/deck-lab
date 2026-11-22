import { describe, expect, it } from "vitest";
import {
  growthCsv,
  growthStats,
  historyAfterTurn,
  loadConversation,
  perTurnMeans,
  type TurnRecord,
} from "./context";
import type { TimedEvent } from "./sse";

const ev = (event: string, data: unknown): TimedEvent => ({
  event,
  data,
  t: 0,
});

describe("historyAfterTurn", () => {
  const prior = [
    { role: "user" as const, content: "hi" },
    { role: "assistant" as const, content: "hello" },
  ];

  it("appends the message and the final reply, like the chat panel", () => {
    const next = historyAfterTurn(prior, "Delete slide 2", [
      ev("tool-call", { tool: "delete_slide", args: { id: "x" } }),
      ev("done", { reply: "Deleted slide 2." }),
    ]);
    expect(next).toEqual([
      ...prior,
      { role: "user", content: "Delete slide 2" },
      { role: "assistant", content: "Deleted slide 2." },
    ]);
    expect(prior).toHaveLength(2); // not mutated
  });

  it("keeps streamed text and adds the error message when a turn fails", () => {
    expect(
      historyAfterTurn([], "x", [
        ev("text-delta", { text: "Work" }),
        ev("text-delta", { text: "ing" }),
        ev("error", { error: "boom" }),
      ]),
    ).toEqual([
      { role: "user", content: "x" },
      { role: "assistant", content: "Working" },
      { role: "assistant", content: "Something went wrong: boom" },
    ]);
  });
});

function record(
  turn: number,
  promptTokens?: number,
  toolCalls = 1,
): TurnRecord {
  return {
    turn,
    promptTokens,
    completionTokens: promptTokens === undefined ? undefined : 10,
    historySent: (turn - 1) * 2,
    slideCount: 6,
    toolCalls,
    error: promptTokens === undefined ? "boom" : undefined,
  };
}

describe("perTurnMeans / growthStats", () => {
  it("averages each turn across runs and skips errored runs' tokens", () => {
    const turns = perTurnMeans([
      [record(1, 100), record(2, 200, 0)],
      [record(1, 300), record(2, undefined)],
    ]);
    expect(turns).toEqual([
      {
        turn: 1,
        promptTokens: 200,
        completionTokens: 10,
        toolCallRate: 1,
        errors: 0,
      },
      {
        turn: 2,
        promptTokens: 200,
        completionTokens: 10,
        toolCallRate: 0.5,
        errors: 1,
      },
    ]);
    expect(growthStats(turns)).toEqual({
      firstTurn: 200,
      lastTurn: 200,
      totalPromptTokens: 400,
      totalCompletionTokens: 20,
    });
  });
});

describe("growthCsv", () => {
  it("writes one prompt-token column per label", () => {
    const capped = perTurnMeans([[record(1, 100), record(2, 150)]]);
    const uncapped = perTurnMeans([[record(1, 100), record(2, undefined)]]);
    expect(growthCsv({ "capped-10": capped, uncapped })).toBe(
      [
        "turn,capped-10_prompt_tokens,uncapped_prompt_tokens",
        "1,100,100",
        "2,150,",
      ].join("\n"),
    );
  });
});

describe("context-conversation.json", () => {
  it("is a 30-turn script", () => {
    expect(loadConversation()).toHaveLength(30);
  });
});
