import type { CompletionUsage } from "openai/resources/completions";

// Token counts for one or more OpenAI calls, as reported in the "done" SSE
// event so callers (the eval harness, in particular) can measure cost per
// request without access to the server's OpenAI account.
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Per-call breakdown plus a total. A /api/chat turn that triggers
// generate_deck makes two OpenAI calls (the tool-calling turn, then the
// deck generation itself) - both are reported, and summed into `total`.
export interface UsageReport {
  chat?: TokenUsage;
  generateDeck?: TokenUsage;
  total: TokenUsage;
}

// Streaming responses only include usage when the request sets
// `stream_options: { include_usage: true }` - it then arrives on the final
// chunk (which has an empty `choices` array).
export function toTokenUsage(
  usage: CompletionUsage | null | undefined,
): TokenUsage | undefined {
  if (!usage) return undefined;
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

// Returns undefined when no call reported usage, so the "done" payload
// simply omits the field rather than reporting misleading zeros.
export function buildUsageReport(calls: {
  chat?: TokenUsage;
  generateDeck?: TokenUsage;
}): UsageReport | undefined {
  const reported = [calls.chat, calls.generateDeck].filter(
    (usage): usage is TokenUsage => usage !== undefined,
  );
  if (reported.length === 0) return undefined;
  const total = reported.reduce(
    (sum, usage) => ({
      promptTokens: sum.promptTokens + usage.promptTokens,
      completionTokens: sum.completionTokens + usage.completionTokens,
      totalTokens: sum.totalTokens + usage.totalTokens,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  );
  return { ...calls, total };
}
