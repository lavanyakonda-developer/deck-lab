// Edit accuracy: sends targeted edit requests about the seed deck to the
// running app's /api/chat, applies the streamed tool calls through the real
// deck store, and scores which tool was called, on which slide, and whether
// everything else in the deck survived untouched.
//
//   npm run eval:edit -- --run-id run-2 [--runs 3] [--base-url http://localhost:3000] [--filter delete]

import "./lib/loadEnv";
import { OPENAI_MODEL } from "@/lib/ai/openaiClient";
import { seedDeck } from "@/lib/seedDeck";
import { applyChatEvents } from "./lib/applyEvents";
import {
  assertAppRunning,
  matchesFilter,
  parseEvalOptions,
  repeat,
} from "./lib/cli";
import {
  isClarifyCase,
  loadEditCases,
  scoreEditRun,
  type EditCase,
  type EditRunScore,
} from "./lib/editCases";
import {
  markdownTable,
  runMetadata,
  writeRawResults,
  writeSummary,
} from "./lib/results";
import { postSSE } from "./lib/sse";
import { scoreStrictClarify } from "./lib/strictClarify";
import {
  formatNumber,
  formatPercent,
  formatRateWithInterval,
  p50,
  p95,
  rate,
} from "./lib/stats";
import { estimateCostUsd, JUDGE_MODEL } from "./pricing";

const EVAL_NAME = "edit-accuracy";

interface Metrics {
  runs: number;
  toolAccuracy: number;
  targetAccuracy: number;
  preservationRate: number;
  answeredInTextRate: number;
  invalidCallRate: number;
  clarifyAccuracy: number;
  passRate: number;
  errors: number;
  latencyP50: number;
  latencyP95: number;
}

// Rates are computed over every run of every case, which equals the mean of
// the per-case means since every case runs the same number of times.
function computeMetrics(scores: EditRunScore[]): Metrics {
  const toolRuns = scores.filter((s) => s.kind === "tool");
  const clarifyRuns = scores.filter((s) => s.kind === "clarify");
  const changedRuns = toolRuns.filter((s) => s.preserved !== undefined);
  const latencies = scores.filter((s) => !s.error).map((s) => s.latencyMs);
  return {
    runs: scores.length,
    toolAccuracy: rate(toolRuns.map((s) => s.toolCorrect!)),
    targetAccuracy: rate(toolRuns.map((s) => s.targetCorrect!)),
    preservationRate: rate(changedRuns.map((s) => s.preserved!)),
    answeredInTextRate: rate(toolRuns.map((s) => s.answeredInText!)),
    invalidCallRate: rate(toolRuns.map((s) => s.invalidCall!)),
    clarifyAccuracy: rate(clarifyRuns.map((s) => s.clarifyCorrect!)),
    passRate: rate(scores.map((s) => s.passed)),
    errors: scores.filter((s) => s.error).length,
    latencyP50: p50(latencies),
    latencyP95: p95(latencies),
  };
}

async function runCase(
  testCase: EditCase,
  baseUrl: string,
): Promise<EditRunScore> {
  const result = await postSSE(`${baseUrl}/api/chat`, {
    message: testCase.message,
    deck: seedDeck,
    history: testCase.history ?? [],
    selectedSlideId: testCase.selectedSlideId ?? null,
  });
  const after = applyChatEvents(seedDeck, result.events);
  const score = scoreEditRun(testCase, seedDeck, result, after);
  if (isClarifyCase(testCase)) {
    score.strictClarify = await scoreStrictClarify(testCase, score, seedDeck);
  }
  return score;
}

// Tokens spent by the LLM judge - reported apart from the app's own usage.
function judgeUsageLine(scores: EditRunScore[]): string | undefined {
  const usages = scores.flatMap((s) =>
    s.strictClarify?.judge?.usage ? [s.strictClarify.judge.usage] : [],
  );
  const calls = scores.filter((s) => s.strictClarify?.judge).length;
  if (calls === 0) return undefined;
  const total = usages.reduce(
    (sum, u) => ({
      promptTokens: sum.promptTokens + u.promptTokens,
      completionTokens: sum.completionTokens + u.completionTokens,
      totalTokens: sum.totalTokens + u.totalTokens,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  );
  const cost = estimateCostUsd(JUDGE_MODEL, total);
  const errors = scores.filter((s) => s.strictClarify?.judge?.error).length;
  return `Judge (${JUDGE_MODEL}, temperature 0): ${calls} calls, ${formatNumber(total.promptTokens)} prompt + ${formatNumber(total.completionTokens)} completion tokens${cost === undefined ? "" : `, est. $${formatNumber(cost, 4)}`}, ${errors} errors. Not included in any app token figure.`;
}

function buildSummary(
  cases: EditCase[],
  scoresByCase: Map<string, EditRunScore[]>,
  runs: number,
  runId: string,
): string {
  const all = [...scoresByCase.values()].flat();
  const overall = computeMetrics(all);
  const toolCaseCount = cases.filter((c) => !isClarifyCase(c)).length;
  const clarifyCaseCount = cases.length - toolCaseCount;

  const toolRuns = all.filter((s) => s.kind === "tool");
  const clarifyRuns = all.filter((s) => s.kind === "clarify");
  const changedRuns = toolRuns.filter((s) => s.preserved !== undefined);
  const toolRunsLabel = `${toolCaseCount} tool cases × ${runs} runs`;
  const noSelectionIds = new Set(
    cases.filter((c) => !c.selectedSlideId).map((c) => c.id),
  );
  const noSelectionRuns = all.filter((s) => noSelectionIds.has(s.caseId));
  const casesPassingAllRuns = [...scoresByCase.values()].filter(
    (scores) => scores.length > 0 && scores.every((s) => s.passed),
  ).length;

  // Rates come with a 95% Wilson interval: with 3 runs per case, small
  // differences between runs of this eval are within noise.
  const overallTable = markdownTable(
    ["Metric", "Value (95% CI)", "Expected", "Measured over"],
    [
      [
        "Tool accuracy",
        formatRateWithInterval(toolRuns.map((s) => s.toolCorrect!)),
        "100%",
        toolRunsLabel,
      ],
      [
        "Target accuracy",
        formatRateWithInterval(toolRuns.map((s) => s.targetCorrect!)),
        "100%",
        toolRunsLabel,
      ],
      [
        "Preservation rate",
        formatRateWithInterval(changedRuns.map((s) => s.preserved!)),
        "100%",
        "runs that changed the deck",
      ],
      [
        "Answered in text (no tool call)",
        formatRateWithInterval(toolRuns.map((s) => s.answeredInText!)),
        "0%",
        toolRunsLabel,
      ],
      [
        "Invalid tool call",
        formatRateWithInterval(toolRuns.map((s) => s.invalidCall!)),
        "0%",
        toolRunsLabel,
      ],
      [
        "Clarification accuracy",
        formatRateWithInterval(clarifyRuns.map((s) => s.clarifyCorrect!)),
        "100%",
        `${clarifyCaseCount} ambiguous cases × ${runs} runs`,
      ],
      [
        "Clarification accuracy (strict)",
        formatRateWithInterval(
          clarifyRuns.map((s) => s.strictClarify?.correct === true),
        ),
        "100%",
        `${clarifyCaseCount} ambiguous cases × ${runs} runs`,
      ],
      [
        "Invented selection",
        formatRateWithInterval(
          noSelectionRuns.map((s) => s.inventedSelection !== undefined),
        ),
        "0%",
        `${noSelectionRuns.length} runs of cases with no slide selected`,
      ],
      [
        "Overall pass rate",
        formatRateWithInterval(all.map((s) => s.passed)),
        "100%",
        `${cases.length} cases × ${runs} runs`,
      ],
      [
        "Cases passing all runs",
        `${casesPassingAllRuns} / ${cases.length}`,
        `${cases.length} / ${cases.length}`,
        `${cases.length} cases`,
      ],
      [
        "Latency to done (p50 / p95)",
        `${formatNumber(overall.latencyP50)} / ${formatNumber(overall.latencyP95)} ms`,
        "–",
        "successful runs",
      ],
      ["Errors", String(overall.errors), "0", "error events or HTTP failures"],
    ],
  );

  const categories = [...new Set(cases.map((c) => c.category))];
  const categoryTable = markdownTable(
    [
      "Category",
      "Cases",
      "Tool acc.",
      "Target acc.",
      "Preserved",
      "In text",
      "Invalid",
      "Clarify acc.",
      "Clarify (strict)",
      "Pass",
    ],
    categories.map((category) => {
      const scores = all.filter((s) => s.category === category);
      const m = computeMetrics(scores);
      const caseCount = cases.filter((c) => c.category === category).length;
      const isClarify = scores.every((s) => s.kind === "clarify");
      const dash = "–";
      return [
        category,
        caseCount,
        isClarify ? dash : formatPercent(m.toolAccuracy),
        isClarify ? dash : formatPercent(m.targetAccuracy),
        isClarify ? dash : formatPercent(m.preservationRate),
        isClarify ? dash : formatPercent(m.answeredInTextRate),
        isClarify ? dash : formatPercent(m.invalidCallRate),
        isClarify ? formatPercent(m.clarifyAccuracy) : dash,
        isClarify
          ? formatPercent(
              rate(scores.map((s) => s.strictClarify?.correct === true)),
            )
          : dash,
        formatPercent(m.passRate),
      ];
    }),
  );

  const failures = cases.flatMap((testCase) => {
    const scores = scoresByCase.get(testCase.id) ?? [];
    const failed = scores.filter((s) => !s.passed);
    if (failed.length === 0) return [];
    const details = failed.map((s, i) => {
      const calls = [
        s.calls.length > 0 ? s.calls.join(", ") : "no tool calls",
        ...s.invalidCalls.map((c) => `rejected ${c}`),
      ].join(", ");
      const reply =
        s.reply.length > 160 ? `${s.reply.slice(0, 160)}…` : s.reply;
      return `  - run ${i + 1}: ${calls}; reply: "${reply}" — ${s.problems.join("; ")}`;
    });
    return [
      `- **${testCase.id}** (${testCase.category}) — passed ${scores.length - failed.length}/${scores.length}\n  > ${testCase.message}\n${details.join("\n")}`,
    ];
  });

  // Clarify runs that pass the lenient check but not the strict one (or
  // fail both), with the reason - the lenient pass/fail is unchanged.
  const strictFailures = clarifyRuns
    .filter((s) => s.strictClarify && !s.strictClarify.correct)
    .map((s) => {
      const reply = s.reply.replace(/\s+/g, " ");
      const shortReply = reply.length > 160 ? `${reply.slice(0, 160)}…` : reply;
      return `- **${s.caseId}** (${s.strictClarify!.method}): ${s.strictClarify!.reason} — reply: "${shortReply}"`;
    });
  const judgeLine = judgeUsageLine(all);
  const invented = noSelectionRuns
    .filter((s) => s.inventedSelection !== undefined)
    .map((s) => {
      const reply = s.reply.replace(/\s+/g, " ");
      const shortReply = reply.length > 160 ? `${reply.slice(0, 160)}…` : reply;
      return `- **${s.caseId}**: "${s.inventedSelection}" — reply: "${shortReply}"`;
    });

  return [
    "# Edit accuracy",
    "",
    "Targeted edit requests against the seed deck, sent to the running app's `/api/chat` and applied through the real deck store. See `evals/README.md` for metric definitions.",
    "",
    runMetadata({
      run: runId,
      model: OPENAI_MODEL,
      cases: cases.length,
      "runs per case": runs,
    }),
    "",
    "## Overall",
    "",
    overallTable,
    "",
    "## By category",
    "",
    categoryTable,
    "",
    `## Failed cases (${failures.length})`,
    "",
    failures.length > 0 ? failures.join("\n") : "None.",
    "",
    `## Clarify runs failing the strict check (${strictFailures.length})`,
    "",
    strictFailures.length > 0 ? strictFailures.join("\n") : "None.",
    ...(judgeLine ? ["", judgeLine] : []),
    "",
    `## Replies claiming a selected slide when none was selected (${invented.length})`,
    "",
    invented.length > 0 ? invented.join("\n") : "None.",
  ].join("\n");
}

async function main() {
  const options = parseEvalOptions();
  await assertAppRunning(options.baseUrl);

  const cases = loadEditCases().filter((c) =>
    matchesFilter(options.filter, c.id, c.category),
  );
  if (cases.length === 0) throw new Error("No cases match --filter");

  console.log(
    `Edit accuracy: ${cases.length} cases × ${options.runs} runs against ${options.baseUrl}\n`,
  );

  const scoresByCase = new Map<string, EditRunScore[]>();
  for (const testCase of cases) {
    const scores = await repeat(options.runs, () =>
      runCase(testCase, options.baseUrl),
    );
    scoresByCase.set(testCase.id, scores);
    const passed = scores.filter((s) => s.passed).length;
    const mark = passed === scores.length ? "✓" : "✗";
    console.log(`${mark} ${testCase.id.padEnd(36)} ${passed}/${scores.length}`);
  }

  const summary = buildSummary(
    cases,
    scoresByCase,
    options.runs,
    options.runId,
  );
  const rawFile = writeRawResults(EVAL_NAME, options.runId, {
    options,
    model: OPENAI_MODEL,
    results: Object.fromEntries(scoresByCase),
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
