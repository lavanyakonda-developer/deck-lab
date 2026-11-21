import { describe, expect, it } from "vitest";
import { buildUsageReport, toTokenUsage } from "./usage";

describe("toTokenUsage", () => {
  it("maps OpenAI's snake_case usage to camelCase", () => {
    expect(
      toTokenUsage({
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
      }),
    ).toEqual({ promptTokens: 100, completionTokens: 20, totalTokens: 120 });
  });

  it("returns undefined when usage wasn't reported", () => {
    expect(toTokenUsage(undefined)).toBeUndefined();
    expect(toTokenUsage(null)).toBeUndefined();
  });
});

describe("buildUsageReport", () => {
  const chat = { promptTokens: 100, completionTokens: 20, totalTokens: 120 };
  const generateDeck = {
    promptTokens: 300,
    completionTokens: 900,
    totalTokens: 1200,
  };

  it("sums every reported call into total", () => {
    expect(buildUsageReport({ chat, generateDeck })).toEqual({
      chat,
      generateDeck,
      total: { promptTokens: 400, completionTokens: 920, totalTokens: 1320 },
    });
  });

  it("reports a single call as its own total", () => {
    expect(buildUsageReport({ chat })).toEqual({ chat, total: chat });
  });

  it("returns undefined when no call reported usage", () => {
    expect(buildUsageReport({})).toBeUndefined();
  });
});
