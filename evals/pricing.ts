import type { TokenUsage } from "@/lib/ai/usage";

// The model that grades replies in LLM-judged metrics (see
// evals/lib/judge.ts). Its tokens are reported separately from the app's.
export const JUDGE_MODEL = "gpt-4o-mini";

// USD per 1M tokens, used only to turn measured token counts into an
// estimated cost. Edit these when prices change, or add your model - check
// OpenAI's pricing page before publishing numbers. Cached-input discounts
// are ignored, so estimates are an upper bound.
export const MODEL_PRICES_PER_MILLION_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
};

// Exact match first, then the longest key the model name starts with, so a
// dated snapshot like "gpt-4o-2024-08-06" uses "gpt-4o" (and not a shorter,
// different model's price).
export function priceFor(
  model: string,
  prices = MODEL_PRICES_PER_MILLION_TOKENS,
): { input: number; output: number } | undefined {
  if (prices[model]) return prices[model];
  const key = Object.keys(prices)
    .filter((name) => model.startsWith(`${name}-`))
    .sort((a, b) => b.length - a.length)[0];
  return key ? prices[key] : undefined;
}

// Undefined when the model has no configured price.
export function estimateCostUsd(
  model: string,
  usage: TokenUsage,
  prices = MODEL_PRICES_PER_MILLION_TOKENS,
): number | undefined {
  const price = priceFor(model, prices);
  if (!price) return undefined;
  return (
    (usage.promptTokens * price.input + usage.completionTokens * price.output) /
    1_000_000
  );
}
