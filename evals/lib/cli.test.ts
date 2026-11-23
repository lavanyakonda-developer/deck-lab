import { describe, expect, it } from "vitest";
import { matchesFilter, parseEvalOptions } from "./cli";

describe("parseEvalOptions", () => {
  it("requires a run id so runs never overwrite each other", () => {
    expect(() => parseEvalOptions([])).toThrow(/--run-id is required/);
    expect(() => parseEvalOptions(["--run-id", "../x"])).toThrow(
      /--run-id is required/,
    );
  });

  it("parses the shared flags with their defaults", () => {
    expect(parseEvalOptions(["--run-id", "run-2"])).toEqual({
      runId: "run-2",
      runs: 3,
      baseUrl: "http://localhost:3000",
      filter: undefined,
      label: undefined,
    });
  });
});

describe("matchesFilter", () => {
  it("matches everything without a filter", () => {
    expect(matchesFilter(undefined, "add-after-3", "add")).toBe(true);
  });

  it("matches a single substring, as before", () => {
    expect(matchesFilter("delete", "delete-last", "delete")).toBe(true);
    expect(matchesFilter("delete", "add-at-end", "add")).toBe(false);
  });

  it("matches any of several comma-separated terms", () => {
    const filter = "named-with-selection, ambiguous";
    expect(matchesFilter(filter, "x", "ambiguous-no-selection")).toBe(true);
    expect(matchesFilter(filter, "x", "named-with-selection")).toBe(true);
    expect(matchesFilter(filter, "x", "named-and-selected")).toBe(false);
  });
});
