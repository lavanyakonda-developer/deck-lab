// Tool calling vs. a naive full-deck baseline, on single-slide edits.
//
// Before every case, the deck is edited by hand: MY MANUAL EDIT is appended
// to slide 2's title, and slide 4's title is moved, resized and restyled.
// The same request then goes (a) to the app's /api/chat, whose tool calls
// are applied through the deck store, and (b) straight to OpenAI with the
// full deck JSON and "return the full updated deck". Both results are
// compared with the manually edited deck. Everything runs on two decks: the
// 6-slide seed deck and a 20-slide deck (the seed plus 14 fixed slides).
//
//   npm run eval:baseline -- --run-id run-2 [--runs 3] [--base-url http://localhost:3000]

import "./lib/loadEnv";
import { OPENAI_MODEL } from "@/lib/ai/openaiClient";
import type { UsageReport } from "@/lib/ai/usage";
import { seedDeck } from "@/lib/seedDeck";
import type { Deck } from "@/lib/schema/slide";
import { applyChatEvents } from "./lib/applyEvents";
import {
  baselineCases,
  compareEdit,
  largeDeck,
  MANUAL_EDIT_SLIDE_INDEX,
  MANUAL_LAYOUT_SLIDE_INDEX,
  runFullDeckBaseline,
  withManualEdits,
  type EditComparison,
} from "./lib/baseline";
import {
  assertAppRunning,
  matchesFilter,
  parseEvalOptions,
  repeat,
} from "./lib/cli";
import { actualCalls } from "./lib/editCases";
import {
  markdownTable,
  runMetadata,
  writeRawResults,
  writeSummary,
} from "./lib/results";
import { eventsOfType, postSSE } from "./lib/sse";
import { formatNumber, formatPercent, mean, p50, p95, rate } from "./lib/stats";
import { estimateCostUsd } from "./pricing";

const EVAL_NAME = "baseline-comparison";

type Approach = "toolCalling" | "fullDeck";

interface ApproachRun extends Partial<EditComparison> {
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
  error?: string;
  // Tool calling only: what the app did and said, for diagnosing misses.
  calls?: string[];
  invalidCalls?: string[];
  reply?: string;
}

interface CaseRun {
  deck: string;
  caseId: string;
  targetIndex: number;
  toolCalling: ApproachRun;
  fullDeck: ApproachRun;
}

const DECKS: Array<{ name: string; build: () => Deck }> = [
  { name: "seed", build: () => structuredClone(seedDeck) },
  { name: "large", build: largeDeck },
];

async function runToolCalling(
  baseUrl: string,
  before: Deck,
  message: string,
  targetIndex: number,
): Promise<ApproachRun> {
  const result = await postSSE(`${baseUrl}/api/chat`, {
    message,
    deck: before,
    history: [],
    selectedSlideId: null,
  });
  const done = eventsOfType<{ reply?: string; usage?: UsageReport }>(
    result.events,
    "done",
  )[0];
  const error =
    eventsOfType<{ error: string }>(result.events, "error")[0]?.error ??
    (result.httpError ? `HTTP ${result.status}` : undefined) ??
    (done ? undefined : "stream ended without a done event");
  const after = applyChatEvents(before, result.events);
  return {
    ...(error ? {} : compareEdit(before, after, targetIndex)),
    promptTokens: done?.usage?.total.promptTokens,
    completionTokens: done?.usage?.total.completionTokens,
    latencyMs:
      result.events.find((e) => e.event === "done")?.t ?? result.totalMs,
    error,
    calls: actualCalls(result).map((c) => c.label),
    invalidCalls: eventsOfType<{ tool: string; error: string }>(
      result.events,
      "invalid-tool-call",
    ).map((c) => `${c.tool}: ${c.error}`),
    reply: done?.reply ?? "",
  };
}

async function runFullDeck(
  before: Deck,
  message: string,
  targetIndex: number,
): Promise<ApproachRun> {
  const result = await runFullDeckBaseline(before, message);
  return {
    ...(result.after ? compareEdit(before, result.after, targetIndex) : {}),
    promptTokens: result.usage?.promptTokens,
    completionTokens: result.usage?.completionTokens,
    latencyMs: result.latencyMs,
    error: result.error,
  };
}

// Errored runs count as failures in every rate and are left out of token,
// cost and latency figures.
function approachMetrics(runs: CaseRun[], approach: Approach) {
  const all = runs.map((r) => r[approach]);
  const ok = all.filter((r) => !r.error);
  // A manual edit only has to survive when the request targets some other
  // slide - when its slide is the target, changing it is allowed.
  const survivalRuns = (slideIndex: number) =>
    runs.filter((r) => r.targetIndex !== slideIndex).map((r) => r[approach]);
  const textRuns = survivalRuns(MANUAL_EDIT_SLIDE_INDEX);
  const layoutRuns = survivalRuns(MANUAL_LAYOUT_SLIDE_INDEX);
  const numbers = (pick: (r: ApproachRun) => number | undefined) =>
    ok.map(pick).filter((n): n is number => n !== undefined);
  const flag = (list: ApproachRun[], key: keyof EditComparison) =>
    rate(list.map((r) => !r.error && r[key] === true));
  const costs = numbers((r) =>
    r.promptTokens === undefined || r.completionTokens === undefined
      ? undefined
      : estimateCostUsd(OPENAI_MODEL, {
          promptTokens: r.promptTokens,
          completionTokens: r.completionTokens,
          totalTokens: r.promptTokens + r.completionTokens,
        }),
  );
  return {
    textSurvival: flag(textRuns, "manualEditSurvived"),
    textRunCount: textRuns.length,
    layoutSurvival: flag(layoutRuns, "manualLayoutSurvived"),
    layoutRunCount: layoutRuns.length,
    preservation: flag(all, "nonTargetPreserved"),
    targetChanged: flag(all, "targetChanged"),
    slideCountChanged: flag(all, "slideCountChanged"),
    promptTokens: mean(numbers((r) => r.promptTokens)),
    completionTokens: mean(numbers((r) => r.completionTokens)),
    cost: mean(costs),
    latencyP50: p50(numbers((r) => r.latencyMs)),
    latencyP95: p95(numbers((r) => r.latencyMs)),
    errors: all.length - ok.length,
  };
}

function comparisonTable(runs: CaseRun[]): string {
  const tool = approachMetrics(runs, "toolCalling");
  const full = approachMetrics(runs, "fullDeck");
  const row = (
    label: string,
    expected: string,
    format: (m: typeof tool) => string,
  ) => [label, format(tool), format(full), expected];

  return markdownTable(
    ["Metric", "Tool calling (`/api/chat`)", "Full-deck baseline", "Expected"],
    [
      row(
        `Manual text edit survived (${tool.textRunCount} runs)`,
        "100%",
        (m) => formatPercent(m.textSurvival),
      ),
      row(`Manual layout survived (${tool.layoutRunCount} runs)`, "100%", (m) =>
        formatPercent(m.layoutSurvival),
      ),
      row("Non-target slides preserved", "100%", (m) =>
        formatPercent(m.preservation),
      ),
      row("Target slide changed", "100%", (m) =>
        formatPercent(m.targetChanged),
      ),
      row("Slide count changed", "0%", (m) =>
        formatPercent(m.slideCountChanged),
      ),
      row("Prompt tokens / edit (mean)", "–", (m) =>
        formatNumber(m.promptTokens),
      ),
      row("Completion tokens / edit (mean)", "–", (m) =>
        formatNumber(m.completionTokens),
      ),
      row("Est. cost / edit (USD)", "–", (m) =>
        Number.isNaN(m.cost) ? "n/a" : `$${formatNumber(m.cost, 4)}`,
      ),
      row(
        "Latency p50 / p95 (ms)",
        "–",
        (m) => `${formatNumber(m.latencyP50)} / ${formatNumber(m.latencyP95)}`,
      ),
      row("Errors", "0", (m) => String(m.errors)),
    ],
  );
}

function perCaseTable(runs: CaseRun[]): string {
  const byCase = new Map<string, CaseRun[]>();
  for (const run of runs)
    byCase.set(run.caseId, [...(byCase.get(run.caseId) ?? []), run]);

  const count = (
    list: CaseRun[],
    approach: Approach,
    key: keyof EditComparison,
  ) =>
    `${list.filter((r) => !r[approach].error && r[approach][key] === true).length}/${list.length}`;
  const cell = (list: CaseRun[], approach: Approach) => {
    const target = list[0].targetIndex;
    const survived = (slideIndex: number, key: keyof EditComparison) =>
      target === slideIndex ? "n/a" : count(list, approach, key);
    return [
      count(list, approach, "targetChanged"),
      count(list, approach, "nonTargetPreserved"),
      survived(MANUAL_EDIT_SLIDE_INDEX, "manualEditSurvived"),
      survived(MANUAL_LAYOUT_SLIDE_INDEX, "manualLayoutSurvived"),
    ].join(" / ");
  };

  return markdownTable(
    [
      "Case",
      "Target",
      "Tool: changed / preserved / text / layout",
      "Baseline: changed / preserved / text / layout",
    ],
    [...byCase].map(([caseId, list]) => [
      caseId,
      `slide ${list[0].targetIndex + 1}`,
      cell(list, "toolCalling"),
      cell(list, "fullDeck"),
    ]),
  );
}

// Tool-calling runs that left the target unchanged, with what came back.
function toolMisses(runs: CaseRun[]): string {
  const misses = runs.filter(
    (r) => !r.toolCalling.error && r.toolCalling.targetChanged !== true,
  );
  if (misses.length === 0) return "None.";
  return misses
    .map((r) => {
      const t = r.toolCalling;
      const calls = [
        ...(t.calls?.length ? t.calls : ["no tool calls"]),
        ...(t.invalidCalls ?? []).map((c) => `rejected ${c}`),
      ].join(", ");
      const reply = (t.reply ?? "").replace(/\s+/g, " ");
      const shortReply = reply.length > 200 ? `${reply.slice(0, 200)}…` : reply;
      return `- **${r.caseId}** (${r.deck} deck): ${calls}; reply: "${shortReply}"`;
    })
    .join("\n");
}

function buildSummary(
  runs: CaseRun[],
  caseCount: number,
  runsPerCase: number,
  runId: string,
  slideCounts: Record<string, number>,
): string {
  const sections = DECKS.flatMap(({ name }) => {
    const deckRuns = runs.filter((r) => r.deck === name);
    if (deckRuns.length === 0) return [];
    return [
      `## ${name === "seed" ? "Seed deck" : "Large deck"} (${slideCounts[name]} slides)`,
      "",
      comparisonTable(deckRuns),
      "",
      "### Per case",
      "",
      perCaseTable(deckRuns),
      "",
      "### Tool-calling runs that left the target unchanged",
      "",
      toolMisses(deckRuns),
      "",
    ];
  });

  return [
    "# Tool calling vs. full-deck regeneration",
    "",
    "Single-slide edit requests from the edit-accuracy cases. Before each one, the deck is edited by hand: `MY MANUAL EDIT` is appended to slide 2's title, and slide 4's title is moved, resized and restyled. The same request then goes to the app (targeted tool calls) and to a baseline that sends the full deck JSON to the same model and asks for the full updated deck back (same structured-output schema). Text is compared by slide position and visible content; layout by element frames and styles. The baseline rebuilds every slide's layout from scratch, so its manual-layout survival is 0% by construction, not by chance. See `evals/README.md` for metric definitions.",
    "",
    runMetadata({
      run: runId,
      model: OPENAI_MODEL,
      cases: caseCount,
      "runs per case": runsPerCase,
      decks: DECKS.map(
        ({ name }) => `${name} (${slideCounts[name]} slides)`,
      ).join(", "),
    }),
    "",
    ...sections,
  ].join("\n");
}

async function main() {
  const options = parseEvalOptions();
  await assertAppRunning(options.baseUrl);

  const cases = baselineCases().filter(({ testCase }) =>
    matchesFilter(options.filter, testCase.id, testCase.category),
  );
  if (cases.length === 0) throw new Error("No cases match --filter");
  console.log(
    `Baseline comparison: ${cases.length} cases × ${options.runs} runs × ${DECKS.length} decks against ${options.baseUrl}\n`,
  );

  const runs: CaseRun[] = [];
  const slideCounts: Record<string, number> = {};
  for (const { name, build } of DECKS) {
    const before = withManualEdits(build());
    slideCounts[name] = before.slides.length;
    for (const { testCase, targetIndex } of cases) {
      const caseRuns = await repeat(options.runs, async () => ({
        deck: name,
        caseId: testCase.id,
        targetIndex,
        toolCalling: await runToolCalling(
          options.baseUrl,
          before,
          testCase.message,
          targetIndex,
        ),
        fullDeck: await runFullDeck(before, testCase.message, targetIndex),
      }));
      runs.push(...caseRuns);
      const changed = (approach: Approach) =>
        caseRuns.filter((r) => r[approach].targetChanged).length;
      console.log(
        `${name.padEnd(5)} ${testCase.id.padEnd(30)} target changed — tool ${changed("toolCalling")}/${caseRuns.length}, baseline ${changed("fullDeck")}/${caseRuns.length}`,
      );
    }
  }

  const summary = buildSummary(
    runs,
    cases.length,
    options.runs,
    options.runId,
    slideCounts,
  );
  const rawFile = writeRawResults(EVAL_NAME, options.runId, {
    options,
    model: OPENAI_MODEL,
    runs,
  });
  const summaryFile = writeSummary(EVAL_NAME, options.runId, summary);

  console.log(`\n${summary}\n`);
  console.log(`Raw results: ${rawFile}`);
  console.log(`Summary:     ${summaryFile}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
