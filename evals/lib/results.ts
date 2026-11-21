import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const RESULTS_DIR = path.join(import.meta.dirname, "..", "results");
const RAW_DIR = path.join(RESULTS_DIR, "raw");

// Full per-run data, timestamped so runs never overwrite each other.
// evals/results/raw/ is gitignored.
export function writeRawResults(evalName: string, data: unknown): string {
  mkdirSync(RAW_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(RAW_DIR, `${evalName}-${stamp}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

// The committed, human-readable summary. Overwritten on each run.
export function writeSummary(
  evalName: string,
  markdown: string,
  extension = "md",
): string {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, `${evalName}.${extension}`);
  writeFileSync(file, markdown.endsWith("\n") ? markdown : `${markdown}\n`);
  return file;
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
