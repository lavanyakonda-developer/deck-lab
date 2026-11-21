export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Linear interpolation between closest ranks (the same definition numpy
// uses by default). `p` is 0-100.
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}

export const p50 = (values: number[]) => percentile(values, 50);
export const p95 = (values: number[]) => percentile(values, 95);

// Share of `true` values, 0-1.
export function rate(flags: boolean[]): number {
  return mean(flags.map((flag) => (flag ? 1 : 0)));
}

export function formatPercent(fraction: number): string {
  return Number.isNaN(fraction) ? "n/a" : `${(fraction * 100).toFixed(1)}%`;
}

export function formatNumber(value: number, digits = 0): string {
  return Number.isNaN(value)
    ? "n/a"
    : value.toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
}
