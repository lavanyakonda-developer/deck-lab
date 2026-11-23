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

// 95% Wilson score interval for `successes` out of `n` - better behaved
// than the normal approximation near 0% and 100% and for small n.
export function wilsonInterval(
  successes: number,
  n: number,
  z = 1.96,
): { low: number; high: number } {
  if (n === 0) return { low: NaN, high: NaN };
  const p = successes / n;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half =
    (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

// "93.1% (87.7–96.2%)" for a list of pass/fail flags.
export function formatRateWithInterval(flags: boolean[]): string {
  if (flags.length === 0) return "n/a";
  const successes = flags.filter(Boolean).length;
  const { low, high } = wilsonInterval(successes, flags.length);
  const pct = (x: number) => (x * 100).toFixed(1);
  return `${pct(successes / flags.length)}% (${pct(low)}–${pct(high)}%)`;
}
