// Context growth: plays a scripted 30-turn editing conversation against the
// running app's /api/chat, carrying the deck and chat history forward
// exactly the way the chat panel does, and records prompt tokens per turn.
//
// The history cap is a server setting (CHAT_MAX_HISTORY_MESSAGES), so the
// capped and uncapped runs need a server restart in between. Each run is
// stored under its --label; the CSV and summary combine the latest run of
// every label. See evals/README.md for the exact steps.
//
//   npm run eval:context -- --label capped-10 [--runs 3] [--base-url ...]

import "./lib/loadEnv";
import { OPENAI_MODEL } from "@/lib/ai/openaiClient";
import { seedDeck } from "@/lib/seedDeck";
import type { Deck } from "@/lib/schema/slide";
import { useDeckStore } from "@/store/deckStore";
import { applyChatEvents } from "./lib/applyEvents";
import { assertAppRunning, parseEvalOptions, repeat } from "./lib/cli";
import {
  growthCsv,
  growthStats,
  historyAfterTurn,
  loadConversation,
  perTurnMeans,
  turnUsage,
  type HistoryMessage,
  type TurnRecord,
  type TurnSummary,
} from "./lib/context";
import {
  markdownTable,
  readRawResults,
  runMetadata,
  writeRawResults,
  writeSummary,
} from "./lib/results";
import { eventsOfType, postSSE } from "./lib/sse";
import { formatNumber, formatPercent, mean } from "./lib/stats";
import { estimateCostUsd } from "./pricing";

const EVAL_NAME = "context-growth";

interface ContextRun {
  label: string;
  model: string;
  runs: number;
  date: string;
  conversations: TurnRecord[][];
}

async function playConversation(
  baseUrl: string,
  messages: string[],
): Promise<TurnRecord[]> {
  let deck: Deck = structuredClone(seedDeck);
  let selectedSlideId: string | null = deck.slides[0]?.id ?? null;
  let history: HistoryMessage[] = [];
  const records: TurnRecord[] = [];

  for (const [i, message] of messages.entries()) {
    const result = await postSSE(`${baseUrl}/api/chat`, {
      message,
      deck,
      history,
      selectedSlideId,
    });
    const events = result.events;
    const toolCalls = eventsOfType(events, "tool-call").length;
    const error =
      eventsOfType<{ error: string }>(events, "error")[0]?.error ??
      (result.httpError ? `HTTP ${result.status}` : undefined);
    const usage = turnUsage(events);

    records.push({
      turn: i + 1,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      historySent: history.length,
      slideCount: deck.slides.length,
      toolCalls,
      error,
    });

    // Carry the edited deck forward. Tool calls move the selection the
    // same way they do in the editor; otherwise it stays where it was.
    deck = applyChatEvents(deck, events);
    const changedSelection =
      toolCalls > 0 ||
      events.some(
        (e) =>
          e.event === "done" &&
          (e.data as { generatedDeck?: unknown }).generatedDeck,
      );
    if (changedSelection) {
      selectedSlideId = useDeckStore.getState().selectedSlideId;
    } else if (!deck.slides.some((s) => s.id === selectedSlideId)) {
      selectedSlideId = deck.slides[0]?.id ?? null;
    }
    history = historyAfterTurn(history, message, events);

    const tokens = usage ? `${usage.promptTokens} prompt tokens` : "no usage";
    console.log(
      `  turn ${String(i + 1).padStart(2)}: ${tokens}, ${toolCalls} tool call(s)${error ? `, error: ${error}` : ""}`,
    );
  }
  return records;
}

// The most recent run of every label, in the order they were first run.
function latestRunPerLabel(): ContextRun[] {
  const byLabel = new Map<string, ContextRun>();
  for (const { data } of readRawResults<ContextRun>(EVAL_NAME)) {
    byLabel.set(data.label, data);
  }
  return [...byLabel.values()];
}

function buildSummary(runs: ContextRun[], turnCount: number): string {
  const turnsByLabel = Object.fromEntries(
    runs.map((run) => [run.label, perTurnMeans(run.conversations)]),
  );
  const at = (turns: TurnSummary[], turn: number) =>
    formatNumber(turns[turn - 1]?.promptTokens ?? NaN);

  const table = markdownTable(
    [
      "Run",
      "Prompt tokens, turn 1",
      "Turn 10",
      `Turn ${turnCount}`,
      `Total prompt tokens (${turnCount} turns)`,
      "Est. cost / conversation",
      "Turns with a tool call",
      "Errors",
      "Runs",
    ],
    runs.map((run) => {
      const turns = turnsByLabel[run.label];
      const stats = growthStats(turns);
      const cost = estimateCostUsd(run.model, {
        promptTokens: stats.totalPromptTokens,
        completionTokens: stats.totalCompletionTokens,
        totalTokens: stats.totalPromptTokens + stats.totalCompletionTokens,
      });
      return [
        run.label,
        at(turns, 1),
        at(turns, 10),
        at(turns, turnCount),
        formatNumber(stats.totalPromptTokens),
        cost === undefined ? "n/a" : `$${formatNumber(cost, 3)}`,
        formatPercent(mean(turns.map((t) => t.toolCallRate))),
        String(turns.reduce((n, t) => n + t.errors, 0)),
        String(run.runs),
      ];
    }),
  );

  const totals = runs
    .map((run) => ({
      label: run.label,
      total: growthStats(turnsByLabel[run.label]).totalPromptTokens,
    }))
    .sort((a, b) => a.total - b.total);
  const comparison =
    totals.length >= 2 && totals.at(-1)!.total > 0
      ? `\n\n**${totals[0].label}** sends ${formatPercent(1 - totals[0].total / totals.at(-1)!.total)} fewer prompt tokens over the conversation than **${totals.at(-1)!.label}**.`
      : "";

  return [
    "# Context growth",
    "",
    `A scripted ${turnCount}-turn editing conversation on the seed deck (\`evals/cases/context-conversation.json\`), sent to \`/api/chat\` with the deck and chat history carried forward the way the chat panel does. Each row is one server configuration (\`CHAT_MAX_HISTORY_MESSAGES\`), labelled when it was run. Per-turn prompt tokens for plotting are in \`context-growth.csv\`. See \`evals/README.md\` for details.`,
    "",
    runMetadata({
      model: runs.map((r) => r.model).join(", "),
      runs: runs.map((r) => `${r.label} (${r.date})`).join(", "),
    }),
    "",
    table + comparison,
  ].join("\n");
}

async function main() {
  const options = parseEvalOptions();
  const label = options.label;
  if (!label || !/^[a-z0-9_-]+$/i.test(label)) {
    throw new Error(
      [
        "Pass --label to name this run (letters, digits, - and _), matching how the server was started:",
        "  capped (default):  npm run dev                               then  npm run eval:context -- --label capped-10",
        "  uncapped:          CHAT_MAX_HISTORY_MESSAGES=0 npm run dev   then  npm run eval:context -- --label uncapped",
      ].join("\n"),
    );
  }
  await assertAppRunning(options.baseUrl);

  const messages = loadConversation();
  console.log(
    `Context growth "${label}": ${messages.length} turns × ${options.runs} runs against ${options.baseUrl}`,
  );
  console.log(
    "The history cap is read by the server - make sure it was started with the CHAT_MAX_HISTORY_MESSAGES this label describes.\n",
  );

  const conversations = await repeat(options.runs, (runIndex) => {
    console.log(`Run ${runIndex + 1}/${options.runs}`);
    return playConversation(options.baseUrl, messages);
  });

  const run: ContextRun = {
    label,
    model: OPENAI_MODEL,
    runs: options.runs,
    date: new Date().toISOString().slice(0, 10),
    conversations,
  };
  const rawFile = writeRawResults(EVAL_NAME, run);

  const runs = latestRunPerLabel();
  const csvFile = writeSummary(
    EVAL_NAME,
    growthCsv(
      Object.fromEntries(
        runs.map((r) => [r.label, perTurnMeans(r.conversations)]),
      ),
    ),
    "csv",
  );
  const summary = buildSummary(runs, messages.length);
  const summaryFile = writeSummary(EVAL_NAME, summary);

  console.log(`\n${summary}\n`);
  console.log(`Raw results: ${rawFile}`);
  console.log(`CSV:         ${csvFile}`);
  console.log(`Summary:     ${summaryFile}`);
  if (runs.length < 2) {
    console.log(
      "\nOnly one label so far. Restart the server with the other CHAT_MAX_HISTORY_MESSAGES setting and run again with a different --label to compare.",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
