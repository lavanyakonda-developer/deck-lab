import { describe, expect, it } from "vitest";
import {
  formatPercent,
  formatRateWithInterval,
  mean,
  p50,
  p95,
  percentile,
  rate,
  wilsonInterval,
} from "./stats";

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

describe("wilsonInterval", () => {
  it("matches reference values", () => {
    const { low, high } = wilsonInterval(134, 144);
    expect(low).toBeCloseTo(0.8768, 3);
    expect(high).toBeCloseTo(0.962, 3);
  });

  it("stays within 0-1 at the extremes", () => {
    expect(wilsonInterval(10, 10).high).toBe(1);
    expect(wilsonInterval(10, 10).low).toBeCloseTo(0.7225, 3);
    expect(wilsonInterval(0, 10).low).toBe(0);
    expect(Number.isNaN(wilsonInterval(0, 0).low)).toBe(true);
  });

  it("formats a rate with its interval", () => {
    expect(formatRateWithInterval([true, true, true, false])).toBe(
      "75.0% (30.1–95.4%)",
    );
    expect(formatRateWithInterval([])).toBe("n/a");
  });
});
