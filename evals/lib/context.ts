import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { UsageReport } from "@/lib/ai/usage";
import { eventsOfType, type TimedEvent } from "./sse";
import { mean } from "./stats";

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

const CONVERSATION_FILE = path.join(
  import.meta.dirname,
  "..",
  "cases",
  "context-conversation.json",
);

// The scripted user messages, one per turn.
export function loadConversation(file = CONVERSATION_FILE): string[] {
  return z
    .array(z.string().min(1))
    .min(1)
    .parse(JSON.parse(readFileSync(file, "utf8")));
}

// The chat history after one turn, built the way ChatPanel builds its
// message list: the user's message, then the assistant message the panel
// shows - the final reply from "done", or the streamed text so far plus a
// "Something went wrong" message if the turn failed.
export function historyAfterTurn(
  history: HistoryMessage[],
  message: string,
  events: TimedEvent[],
): HistoryMessage[] {
  const next: HistoryMessage[] = [
    ...history,
    { role: "user", content: message },
  ];
  const done = eventsOfType<{ reply: string }>(events, "done")[0];
  if (done) return [...next, { role: "assistant", content: done.reply }];

  const streamed = eventsOfType<{ text: string }>(events, "text-delta")
    .map((d) => d.text)
    .join("");
  if (streamed) next.push({ role: "assistant", content: streamed });
  const error = eventsOfType<{ error: string }>(events, "error")[0];
  if (error) {
    next.push({
      role: "assistant",
      content: `Something went wrong: ${error.error}`,
    });
  }
  return next;
}

export interface TurnRecord {
  turn: number;
  promptTokens?: number;
  completionTokens?: number;
  // Messages the client sent as history; the server then trims them to
  // its cap, so the prompt tokens show the effect of the cap.
  historySent: number;
  slideCount: number;
  toolCalls: number;
  error?: string;
}

export function turnUsage(events: TimedEvent[]) {
  const done = eventsOfType<{ usage?: UsageReport }>(events, "done")[0];
  return done?.usage?.total;
}

export interface TurnSummary {
  turn: number;
  promptTokens: number;
  completionTokens: number;
  // Share of runs in which this turn made at least one tool call.
  toolCallRate: number;
  errors: number;
}

// Averages each turn across repeated runs of the conversation. Runs that
// errored on a turn (no usage) are left out of that turn's token means.
export function perTurnMeans(conversations: TurnRecord[][]): TurnSummary[] {
  const turns = Math.max(0, ...conversations.map((c) => c.length));
  return Array.from({ length: turns }, (_, i) => {
    const records = conversations
      .map((c) => c[i])
      .filter((r): r is TurnRecord => r !== undefined);
    const numbers = (pick: (r: TurnRecord) => number | undefined) =>
      records.map(pick).filter((n): n is number => n !== undefined);
    return {
      turn: i + 1,
      promptTokens: mean(numbers((r) => r.promptTokens)),
      completionTokens: mean(numbers((r) => r.completionTokens)),
      toolCallRate: mean(records.map((r) => (r.toolCalls > 0 ? 1 : 0))),
      errors: records.filter((r) => r.error).length,
    };
  });
}

export interface GrowthStats {
  firstTurn: number;
  lastTurn: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
}

// Totals skip turns where every run errored (NaN means), so they are a
// lower bound when errors occurred - the summary reports the error count.
export function growthStats(turns: TurnSummary[]): GrowthStats {
  const sum = (values: number[]) =>
    values.filter((v) => !Number.isNaN(v)).reduce((a, b) => a + b, 0);
  return {
    firstTurn: turns[0]?.promptTokens ?? NaN,
    lastTurn: turns.at(-1)?.promptTokens ?? NaN,
    totalPromptTokens: sum(turns.map((t) => t.promptTokens)),
    totalCompletionTokens: sum(turns.map((t) => t.completionTokens)),
  };
}

// turn,<label>,<label>... - mean prompt tokens per turn for each run, ready
// for plotting. Missing values are left empty.
export function growthCsv(runs: Record<string, TurnSummary[]>): string {
  const labels = Object.keys(runs);
  const turns = Math.max(0, ...labels.map((l) => runs[l].length));
  const cell = (value: number | undefined) =>
    value === undefined || Number.isNaN(value) ? "" : String(Math.round(value));
  const rows = Array.from({ length: turns }, (_, i) =>
    [i + 1, ...labels.map((l) => cell(runs[l][i]?.promptTokens))].join(","),
  );
  return [
    ["turn", ...labels.map((l) => `${l}_prompt_tokens`)].join(","),
    ...rows,
  ].join("\n");
}
