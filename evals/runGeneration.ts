// Generation quality and streaming: sends the prompts in
// cases/generation-prompts.json to the running app's /api/generate and
// measures success, slide-count accuracy, rich-content coverage, how soon
// the first slide streams in compared with the whole deck, and cost.
//
//   npm run eval:generation -- [--runs 3] [--base-url http://localhost:3000] [--filter open]

import { OPENAI_MODEL } from "@/lib/ai/openaiClient";
import { assertAppRunning, parseEvalOptions, repeat } from "./lib/cli";
import {
  loadGenerationCases,
  scoreGenerationRun,
  type GenerationCase,
  type GenerationRunScore,
} from "./lib/generationCases";
import {
  markdownTable,
  runMetadata,
  writeRawResults,
  writeSummary,
} from "./lib/results";
import { postSSE } from "./lib/sse";
import { formatNumber, formatPercent, mean, p50, p95, rate } from "./lib/stats";
import { estimateCostUsd, priceFor } from "./pricing";

const EVAL_NAME = "generation";

async function runCase(
  testCase: GenerationCase,
  baseUrl: string,
): Promise<GenerationRunScore> {
  const result = await postSSE(`${baseUrl}/api/generate`, {
    prompt: testCase.prompt,
  });
  return scoreGenerationRun(testCase, result);
}

function defined(values: Array<number | undefined>): number[] {
  return values.filter((v): v is number => v !== undefined);
}

function buildSummary(
  cases: GenerationCase[],
  scoresByCase: Map<string, GenerationRunScore[]>,
  runs: number,
): string {
  const all = [...scoresByCase.values()].flat();
  const ok = all.filter((s) => s.success);
  const counted = ok.filter((s) => s.slideCountMatch !== undefined);
  const countedCases = cases.filter((c) => c.expectedSlides !== undefined);
  const costs = defined(
    ok.map((s) => s.usage && estimateCostUsd(OPENAI_MODEL, s.usage)),
  );
  const firstSlide = defined(ok.map((s) => s.firstSlideMs));
  const done = defined(ok.map((s) => s.doneMs));
  const ms = (values: number[]) =>
    `${formatNumber(p50(values))} / ${formatNumber(p95(values))} ms`;

  const qualityTable = markdownTable(
    ["Metric", "Value", "Measured over"],
    [
      [
        "Success rate",
        formatPercent(rate(all.map((s) => s.success))),
        `${cases.length} prompts × ${runs} runs`,
      ],
      [
        "Slide-count match",
        formatPercent(rate(counted.map((s) => s.slideCountMatch!))),
        `successful runs of the ${countedCases.length} prompts with a stated count`,
      ],
      [
        "Decks with a chart",
        formatPercent(rate(ok.map((s) => s.hasChart))),
        "successful runs",
      ],
      [
        "Decks with a table",
        formatPercent(rate(ok.map((s) => s.hasTable))),
        "successful runs",
      ],
      [
        "Decks with an image",
        formatPercent(rate(ok.map((s) => s.hasImage))),
        "successful runs",
      ],
      [
        "Streamed slides match final deck",
        formatPercent(rate(ok.map((s) => s.streamConsistent))),
        "successful runs",
      ],
      [
        "Mean slides per deck",
        formatNumber(mean(ok.map((s) => s.slideCount!)), 1),
        "successful runs",
      ],
    ],
  );

  const streamingTable = markdownTable(
    ["Metric", "p50 / p95"],
    [
      ["Time to first slide", ms(firstSlide)],
      ["Time to full deck (`done`)", ms(done)],
    ],
  );

  const price = priceFor(OPENAI_MODEL);
  const costTable = markdownTable(
    ["Metric", "Mean per deck"],
    [
      [
        "Prompt tokens",
        formatNumber(mean(defined(ok.map((s) => s.usage?.promptTokens)))),
      ],
      [
        "Completion tokens",
        formatNumber(mean(defined(ok.map((s) => s.usage?.completionTokens)))),
      ],
      [
        "Estimated cost (USD)",
        costs.length > 0
          ? `$${formatNumber(mean(costs), 4)}`
          : `n/a (no price configured for ${OPENAI_MODEL} in evals/pricing.ts)`,
      ],
    ],
  );

  const perPrompt = markdownTable(
    [
      "Prompt",
      "Asked",
      "Got (per run)",
      "Chart / Table / Image",
      "First slide / done p50 (ms)",
    ],
    cases.map((testCase) => {
      const scores = scoresByCase.get(testCase.id) ?? [];
      const good = scores.filter((s) => s.success);
      const tally = (pick: (s: GenerationRunScore) => boolean) =>
        `${good.filter(pick).length}/${scores.length}`;
      return [
        testCase.id,
        testCase.expectedSlides ?? "–",
        scores.map((s) => (s.success ? s.slideCount : "✗")).join(", "),
        `${tally((s) => s.hasChart)} / ${tally((s) => s.hasTable)} / ${tally((s) => s.hasImage)}`,
        `${formatNumber(p50(defined(good.map((s) => s.firstSlideMs))))} / ${formatNumber(p50(defined(good.map((s) => s.doneMs))))}`,
      ];
    }),
  );

  const failures = all
    .filter((s) => !s.success)
    .map((s) => `- **${s.caseId}**: ${s.error}`);

  return [
    "# Deck generation",
    "",
    "Prompts from `evals/cases/generation-prompts.json`, sent to the running app's streaming `/api/generate` endpoint. Times are measured from sending the request. See `evals/README.md` for metric definitions.",
    "",
    runMetadata({
      model: OPENAI_MODEL,
      prompts: cases.length,
      "runs per prompt": runs,
      "price per 1M tokens (input / output)": price
        ? `$${price.input} / $${price.output}`
        : "not configured",
    }),
    "",
    "## Quality",
    "",
    qualityTable,
    "",
    "## Streaming",
    "",
    streamingTable,
    "",
    "## Tokens and cost",
    "",
    costTable,
    "",
    "Image generation runs afterwards in the browser through a separate endpoint and is not included in the cost.",
    "",
    "## Per prompt",
    "",
    perPrompt,
    "",
    `## Failed runs (${failures.length})`,
    "",
    failures.length > 0 ? failures.join("\n") : "None.",
  ].join("\n");
}

async function main() {
  const options = parseEvalOptions();
  await assertAppRunning(options.baseUrl);

  const cases = loadGenerationCases().filter(
    (c) => !options.filter || c.id.includes(options.filter),
  );
  if (cases.length === 0) throw new Error("No prompts match --filter");

  console.log(
    `Generation: ${cases.length} prompts × ${options.runs} runs against ${options.baseUrl}\n`,
  );

  const scoresByCase = new Map<string, GenerationRunScore[]>();
  for (const testCase of cases) {
    const scores = await repeat(options.runs, () =>
      runCase(testCase, options.baseUrl),
    );
    scoresByCase.set(testCase.id, scores);
    const counts = scores
      .map((s) => (s.success ? String(s.slideCount) : "✗"))
      .join(", ");
    const asked = testCase.expectedSlides ?? "any";
    console.log(`${testCase.id.padEnd(30)} asked ${asked}, got ${counts}`);
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
