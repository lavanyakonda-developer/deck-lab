import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const RESULTS_DIR = path.join(import.meta.dirname, "..", "results");

// Committed summaries: evals/results/runs/<runId>/<eval>.md (and .csv).
export function runDir(runId: string, resultsDir = RESULTS_DIR): string {
  return path.join(resultsDir, "runs", runId);
}

// Full per-run data: evals/results/raw/<runId>/<eval>-<timestamp>.json.
// Timestamped so repeated runs never overwrite each other; gitignored.
export function rawDir(runId: string, resultsDir = RESULTS_DIR): string {
  return path.join(resultsDir, "raw", runId);
}

export function writeRawResults(
  evalName: string,
  runId: string,
  data: unknown,
  resultsDir = RESULTS_DIR,
): string {
  const dir = rawDir(runId, resultsDir);
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `${evalName}-${stamp}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

// The human-readable summary of one eval in one run. Re-running the same
// eval with the same run id replaces it; other runs are never touched.
export function writeSummary(
  evalName: string,
  runId: string,
  content: string,
  extension = "md",
  resultsDir = RESULTS_DIR,
): string {
  const dir = runDir(runId, resultsDir);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${evalName}.${extension}`);
  writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`);
  return file;
}

// Every raw result file written for `evalName` in `runId`, oldest first
// (the timestamp in the file name sorts chronologically).
export function readRawResults<T>(
  evalName: string,
  runId: string,
  resultsDir = RESULTS_DIR,
): Array<{ file: string; data: T }> {
  const dir = rawDir(runId, resultsDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.startsWith(`${evalName}-`) && name.endsWith(".json"))
    .sort()
    .map((name) => {
      const file = path.join(dir, name);
      return { file, data: JSON.parse(readFileSync(file, "utf8")) as T };
    });
}

export function markdownTable(
  headers: string[],
  rows: Array<Array<string | number>>,
): string {
  const escape = (cell: string | number) =>
    String(cell).replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [
    `| ${headers.map(escape).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escape).join(" | ")} |`),
  ].join("\n");
}

// Header lines recorded on every summary so results are reproducible.
export function runMetadata(details: Record<string, string | number>): string {
  const lines = Object.entries({
    date: new Date().toISOString().slice(0, 10),
    ...details,
  }).map(([key, value]) => `- **${key}**: ${value}`);
  return lines.join("\n");
}
