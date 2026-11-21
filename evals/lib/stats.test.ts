import { describe, expect, it } from "vitest";
import { formatPercent, mean, p50, p95, percentile, rate } from "./stats";

describe("stats", () => {
  it("computes the mean", () => {
    expect(mean([1, 2, 3, 6])).toBe(3);
    expect(mean([])).toBeNaN();
  });

  it("interpolates percentiles between closest ranks", () => {
    const values = [10, 20, 30, 40, 50];
    expect(p50(values)).toBe(30);
    expect(p95(values)).toBeCloseTo(48);
    expect(percentile(values, 0)).toBe(10);
    expect(percentile(values, 100)).toBe(50);
  });

  it("doesn't depend on input order", () => {
    expect(p50([5, 1, 3])).toBe(3);
  });

  it("computes a rate from booleans", () => {
    expect(rate([true, false, true, true])).toBe(0.75);
    expect(formatPercent(0.75)).toBe("75.0%");
    expect(formatPercent(NaN)).toBe("n/a");
  });
});
