import { parseArgs } from "node:util";

export interface EvalOptions {
  // How many times each case runs; metrics are averaged across runs.
  runs: number;
  // Where the app is running (npm run dev, or npm run build && npm start).
  baseUrl: string;
  // Optional substring filter on case ids, for quick partial runs.
  filter?: string;
  // Free-form label stored with the results (e.g. "capped-10").
  label?: string;
  // Names the run; summaries go to evals/results/runs/<runId>/ so runs
  // never overwrite each other.
  runId: string;
}

export function parseEvalOptions(argv = process.argv.slice(2)): EvalOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      runs: { type: "string", default: "3" },
      "base-url": { type: "string", default: "http://localhost:3000" },
      filter: { type: "string" },
      label: { type: "string" },
      "run-id": { type: "string" },
    },
    strict: true,
  });

  const runs = Number(values.runs);
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error(`--runs must be a positive integer (got "${values.runs}")`);
  }

  const runId = values["run-id"];
  if (!runId || !/^[a-z0-9_-]+$/i.test(runId)) {
    throw new Error(
      "--run-id is required (letters, digits, - and _), e.g. --run-id run-2. Results are stored under evals/results/runs/<run-id>/.",
    );
  }

  return {
    runId,
    runs,
    baseUrl: values["base-url"].replace(/\/$/, ""),
    filter: values.filter,
    label: values.label,
  };
}

// Fails fast with a clear message if the app isn't reachable, instead of
// every case erroring one by one.
export async function assertAppRunning(baseUrl: string): Promise<void> {
  try {
    await fetch(baseUrl, { method: "HEAD" });
  } catch {
    throw new Error(
      `Could not reach the app at ${baseUrl}. Start it first with "npm run dev" (or "npm run build && npm start").`,
    );
  }
}

// Runs `fn` `runs` times, one after another (never concurrently - the
// deck store used to apply results is a singleton), and returns every run.
export async function repeat<T>(
  runs: number,
  fn: (runIndex: number) => Promise<T>,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < runs; i++) results.push(await fn(i));
  return results;
}

// --filter matches when any of its comma-separated terms is a substring of
// any of `fields` (e.g. a case id or category). No filter matches all.
export function matchesFilter(
  filter: string | undefined,
  ...fields: string[]
): boolean {
  if (!filter) return true;
  const terms = filter
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return terms.some((term) => fields.some((field) => field.includes(term)));
}
