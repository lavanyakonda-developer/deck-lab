// Edit accuracy: sends targeted edit requests about the seed deck to the
// running app's /api/chat, applies the streamed tool calls through the real
// deck store, and scores which tool was called, on which slide, and whether
// everything else in the deck survived untouched.
//
//   npm run eval:edit -- [--runs 3] [--base-url http://localhost:3000] [--filter delete]

import { OPENAI_MODEL } from "@/lib/ai/openaiClient";
import { seedDeck } from "@/lib/seedDeck";
import { applyChatEvents } from "./lib/applyEvents";
import { assertAppRunning, parseEvalOptions, repeat } from "./lib/cli";
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
import { formatNumber, formatPercent, p50, p95, rate } from "./lib/stats";

const EVAL_NAME = "edit-accuracy";

interface Metrics {
  runs: number;
  toolAccuracy: number;
  targetAccuracy: number;
  preservationRate: number;
  missedRate: number;
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
    missedRate: rate(toolRuns.map((s) => s.missed!)),
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
  return scoreEditRun(testCase, seedDeck, result, after);
}

function buildSummary(
  cases: EditCase[],
  scoresByCase: Map<string, EditRunScore[]>,
  runs: number,
): string {
  const all = [...scoresByCase.values()].flat();
  const overall = computeMetrics(all);
  const toolCaseCount = cases.filter((c) => !isClarifyCase(c)).length;
  const clarifyCaseCount = cases.length - toolCaseCount;

  const overallTable = markdownTable(
    ["Metric", "Value", "Measured over"],
    [
      [
        "Tool accuracy",
        formatPercent(overall.toolAccuracy),
        `${toolCaseCount} tool cases × ${runs} runs`,
      ],
      [
        "Target accuracy",
        formatPercent(overall.targetAccuracy),
        `${toolCaseCount} tool cases × ${runs} runs`,
      ],
      [
        "Preservation rate",
        formatPercent(overall.preservationRate),
        "runs that changed the deck",
      ],
      [
        "Missed/invalid call rate",
        formatPercent(overall.missedRate),
        `${toolCaseCount} tool cases × ${runs} runs`,
      ],
      [
        "Clarification accuracy",
        formatPercent(overall.clarifyAccuracy),
        `${clarifyCaseCount} ambiguous cases × ${runs} runs`,
      ],
      [
        "Overall pass rate",
        formatPercent(overall.passRate),
        `${cases.length} cases × ${runs} runs`,
      ],
      [
        "Latency to done (p50 / p95)",
        `${formatNumber(overall.latencyP50)} / ${formatNumber(overall.latencyP95)} ms`,
        "successful runs",
      ],
      ["Errors", String(overall.errors), "error events or HTTP failures"],
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
      "Missed",
      "Clarify acc.",
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
        isClarify ? dash : formatPercent(m.missedRate),
        isClarify ? formatPercent(m.clarifyAccuracy) : dash,
        formatPercent(m.passRate),
      ];
    }),
  );

  const failures = cases.flatMap((testCase) => {
    const scores = scoresByCase.get(testCase.id) ?? [];
    const failed = scores.filter((s) => !s.passed);
    if (failed.length === 0) return [];
    const details = failed.map((s, i) => {
      const calls = s.calls.length > 0 ? s.calls.join(", ") : "no tool calls";
      const reply =
        s.reply.length > 160 ? `${s.reply.slice(0, 160)}…` : s.reply;
      return `  - run ${i + 1}: ${calls}; reply: "${reply}" — ${s.problems.join("; ")}`;
    });
    return [
      `- **${testCase.id}** (${testCase.category}) — passed ${scores.length - failed.length}/${scores.length}\n  > ${testCase.message}\n${details.join("\n")}`,
    ];
  });

  return [
    "# Edit accuracy",
    "",
    "Targeted edit requests against the seed deck, sent to the running app's `/api/chat` and applied through the real deck store. See `evals/README.md` for metric definitions.",
    "",
    runMetadata({
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
  ].join("\n");
}

async function main() {
  const options = parseEvalOptions();
  await assertAppRunning(options.baseUrl);

  const cases = loadEditCases().filter(
    (c) =>
      !options.filter ||
      c.id.includes(options.filter) ||
      c.category.includes(options.filter),
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

  const summary = buildSummary(cases, scoresByCase, options.runs);
  const rawFile = writeRawResults(EVAL_NAME, {
    options,
    model: OPENAI_MODEL,
    results: Object.fromEntries(scoresByCase),
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
