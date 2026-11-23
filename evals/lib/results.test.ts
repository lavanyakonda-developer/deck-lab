import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readRawResults, writeRawResults, writeSummary } from "./results";

describe("per-run result storage", () => {
  it("keeps each run's summaries and raw files apart", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "evals-"));
    writeSummary("edit-accuracy", "run-1", "# one", "md", dir);
    writeSummary("edit-accuracy", "run-2", "# two", "md", dir);
    expect(
      readFileSync(path.join(dir, "runs/run-1/edit-accuracy.md"), "utf8"),
    ).toBe("# one\n");
    expect(
      readFileSync(path.join(dir, "runs/run-2/edit-accuracy.md"), "utf8"),
    ).toBe("# two\n");

    writeRawResults("context-growth", "run-2", { label: "a" }, dir);
    writeRawResults("context-growth", "run-3", { label: "b" }, dir);
    expect(readdirSync(path.join(dir, "raw"))).toEqual(["run-2", "run-3"]);
    expect(
      readRawResults<{ label: string }>("context-growth", "run-2", dir).map(
        (r) => r.data.label,
      ),
    ).toEqual(["a"]);
    expect(readRawResults("context-growth", "run-9", dir)).toEqual([]);
  });
});
