// Tool calling vs. a naive full-deck baseline, on single-slide edits.
//
// Before every case, slide 2's title is edited by hand ("MY MANUAL EDIT").
// The same request then goes (a) to the app's /api/chat, whose tool calls
// are applied through the deck store, and (b) straight to OpenAI with the
// full deck JSON and "return the full updated deck". Both results are
// compared with the manually edited deck.
//
//   npm run eval:baseline -- [--runs 3] [--base-url http://localhost:3000]

import { OPENAI_MODEL } from "@/lib/ai/openaiClient";
import type { UsageReport } from "@/lib/ai/usage";
import { seedDeck } from "@/lib/seedDeck";
import { applyChatEvents } from "./lib/applyEvents";
import {
  compareEdit,
  MANUAL_EDIT_SLIDE_INDEX,
  runFullDeckBaseline,
  withManualEdit,
  type EditComparison,
} from "./lib/baseline";
import { assertAppRunning, parseEvalOptions, repeat } from "./lib/cli";
import { loadEditCases, toolExpectation, type EditCase } from "./lib/editCases";
import {
  markdownTable,
  runMetadata,
  writeRawResults,
  writeSummary,
} from "./lib/results";
import { eventsOfType, postSSE } from "./lib/sse";
import { formatNumber, formatPercent, mean, p50, p95, rate } from "./lib/stats";

const EVAL_NAME = "baseline-comparison";

type Approach = "toolCalling" | "fullDeck";

interface ApproachRun extends Partial<EditComparison> {
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
  error?: string;
}

interface CaseRun {
  caseId: string;
  targetIndex: number;
  toolCalling: ApproachRun;
  fullDeck: ApproachRun;
}

// Single update_slide edits with no history or selection, so both
// approaches receive exactly the same information.
function singleSlideEditCases(): Array<{
  testCase: EditCase;
  targetIndex: number;
}> {
  return loadEditCases().flatMap((testCase) => {
    const expectation = toolExpectation(testCase);
    if (!expectation || testCase.history || testCase.selectedSlideId) return [];
    const { tools, optional, resultHasBlock } = expectation;
    if (tools.length !== 1 || optional || resultHasBlock) return [];
    const [call] = tools;
    if (call.tool !== "update_slide" || !call.slideId) return [];
    const targetIndex = seedDeck.slides.findIndex((s) => s.id === call.slideId);
    return targetIndex === -1 ? [] : [{ testCase, targetIndex }];
  });
}

async function runToolCalling(
  baseUrl: string,
  before: typeof seedDeck,
  message: string,
  targetIndex: number,
): Promise<ApproachRun> {
  const result = await postSSE(`${baseUrl}/api/chat`, {
    message,
    deck: before,
    history: [],
    selectedSlideId: null,
  });
  const done = result.events.find((e) => e.event === "done");
  const error =
    eventsOfType<{ error: string }>(result.events, "error")[0]?.error ??
    (result.httpError ? `HTTP ${result.status}` : undefined) ??
    (done ? undefined : "stream ended without a done event");
  const usage = (done?.data as { usage?: UsageReport } | undefined)?.usage
    ?.total;
  const after = applyChatEvents(before, result.events);
  return {
    ...(error ? {} : compareEdit(before, after, targetIndex)),
    promptTokens: usage?.promptTokens,
    completionTokens: usage?.completionTokens,
    latencyMs: done?.t ?? result.totalMs,
    error,
  };
}

async function runFullDeck(
  before: typeof seedDeck,
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

function approachMetrics(runs: CaseRun[], approach: Approach) {
  const all = runs.map((r) => r[approach]);
  const ok = all.filter((r) => !r.error);
  // Manual-edit survival is only meaningful when the request targets some
  // other slide - when slide 2 itself is the target, changing it is allowed.
  const survivalRuns = runs
    .filter((r) => r.targetIndex !== MANUAL_EDIT_SLIDE_INDEX)
    .map((r) => r[approach]);
  const numbers = (pick: (r: ApproachRun) => number | undefined) =>
    ok.map(pick).filter((n): n is number => n !== undefined);
  // Errored runs count as failures in the rates.
  return {
    survival: rate(
      survivalRuns.map((r) => !r.error && r.manualEditSurvived === true),
    ),
    survivalRunCount: survivalRuns.length,
    preservation: rate(
      all.map((r) => !r.error && r.nonTargetPreserved === true),
    ),
    targetChanged: rate(all.map((r) => !r.error && r.targetChanged === true)),
    slideCountChanged: rate(
      all.map((r) => !r.error && r.slideCountChanged === true),
    ),
    promptTokens: mean(numbers((r) => r.promptTokens)),
    completionTokens: mean(numbers((r) => r.completionTokens)),
    latencyP50: p50(numbers((r) => r.latencyMs)),
    latencyP95: p95(numbers((r) => r.latencyMs)),
    errors: all.length - ok.length,
  };
}

function buildSummary(
  runs: CaseRun[],
  caseCount: number,
  runsPerCase: number,
): string {
  const tool = approachMetrics(runs, "toolCalling");
  const full = approachMetrics(runs, "fullDeck");
  const row = (label: string, format: (m: typeof tool) => string) => [
    label,
    format(tool),
    format(full),
  ];

  const comparison = markdownTable(
    ["Metric", "Tool calling (`/api/chat`)", "Full-deck baseline"],
    [
      row(`Manual-edit survival (${tool.survivalRunCount} runs)`, (m) =>
        formatPercent(m.survival),
      ),
      row("Non-target slides preserved", (m) => formatPercent(m.preservation)),
      row("Target slide changed", (m) => formatPercent(m.targetChanged)),
      row("Slide count changed", (m) => formatPercent(m.slideCountChanged)),
      row("Prompt tokens / edit (mean)", (m) => formatNumber(m.promptTokens)),
      row("Completion tokens / edit (mean)", (m) =>
        formatNumber(m.completionTokens),
      ),
      row(
        "Latency p50 / p95 (ms)",
        (m) => `${formatNumber(m.latencyP50)} / ${formatNumber(m.latencyP95)}`,
      ),
      row("Errors", (m) => String(m.errors)),
    ],
  );

  const byCase = new Map<string, CaseRun[]>();
  for (const run of runs)
    byCase.set(run.caseId, [...(byCase.get(run.caseId) ?? []), run]);
  const count = (
    list: CaseRun[],
    approach: Approach,
    key: keyof EditComparison,
  ) =>
    `${list.filter((r) => !r[approach].error && r[approach][key] === true).length}/${list.length}`;
  const perCase = markdownTable(
    [
      "Case",
      "Target",
      "Tool: preserved / survived",
      "Baseline: preserved / survived",
    ],
    [...byCase].map(([caseId, list]) => {
      const targetsManualSlide =
        list[0].targetIndex === MANUAL_EDIT_SLIDE_INDEX;
      const survived = (approach: Approach) =>
        targetsManualSlide
          ? "n/a"
          : count(list, approach, "manualEditSurvived");
      return [
        caseId,
        `slide ${list[0].targetIndex + 1}`,
        `${count(list, "toolCalling", "nonTargetPreserved")} / ${survived("toolCalling")}`,
        `${count(list, "fullDeck", "nonTargetPreserved")} / ${survived("fullDeck")}`,
      ];
    }),
  );

  return [
    "# Tool calling vs. full-deck regeneration",
    "",
    'Single-slide edit requests from the edit-accuracy cases. Before each one, slide 2\'s title is manually changed to "MY MANUAL EDIT". The same request then goes to the app (targeted tool calls) and to a baseline that sends the full deck JSON to the same model and asks for the full updated deck back (same structured-output schema). Slides are compared by position and visible content. See `evals/README.md` for metric definitions.',
    "",
    runMetadata({
      model: OPENAI_MODEL,
      cases: caseCount,
      "runs per case": runsPerCase,
    }),
    "",
    "## Comparison",
    "",
    comparison,
    "",
    "## Per case",
    "",
    perCase,
  ].join("\n");
}

async function main() {
  const options = parseEvalOptions();
  await assertAppRunning(options.baseUrl);

  const cases = singleSlideEditCases().filter(
    ({ testCase }) =>
      !options.filter ||
      testCase.id.includes(options.filter) ||
      testCase.category.includes(options.filter),
  );
  if (cases.length === 0) throw new Error("No cases match --filter");
  console.log(
    `Baseline comparison: ${cases.length} cases × ${options.runs} runs against ${options.baseUrl}\n`,
  );

  const before = withManualEdit(seedDeck);
  const runs: CaseRun[] = [];
  for (const { testCase, targetIndex } of cases) {
    const caseRuns = await repeat(options.runs, async () => ({
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
    const preserved = (approach: Approach) =>
      caseRuns.filter((r) => r[approach].nonTargetPreserved).length;
    console.log(
      `${testCase.id.padEnd(36)} preserved — tool ${preserved("toolCalling")}/${caseRuns.length}, baseline ${preserved("fullDeck")}/${caseRuns.length}`,
    );
  }

  const summary = buildSummary(runs, cases.length, options.runs);
  const rawFile = writeRawResults(EVAL_NAME, {
    options,
    model: OPENAI_MODEL,
    runs,
  });
  const summaryFile = writeSummary(EVAL_NAME, summary);

  console.log(`\n${summary}\n`);
  console.log(`Raw results: ${rawFile}`);
  console.log(`Summary:     ${summaryFile}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
