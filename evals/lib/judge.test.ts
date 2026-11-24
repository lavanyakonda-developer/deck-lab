import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/openaiClient", () => ({
  getOpenAIClient: () => {
    throw new Error("tests must pass a client");
  },
  OPENAI_MODEL: "gpt-4o",
}));

import { JUDGE_MODEL } from "../pricing";
import {
  buildClarifyJudgeMessages,
  CLARIFY_JUDGE_RUBRIC,
  judgeClarifyReply,
  parseJudgeVerdict,
} from "./judge";

function fakeClient(create: ReturnType<typeof vi.fn>) {
  return { chat: { completions: { create } } } as never;
}

describe("buildClarifyJudgeMessages", () => {
  it("puts the rubric in the system message and both texts in the user message", () => {
    const messages = buildClarifyJudgeMessages(
      "Change the title to 'Overview'",
      "Which slide do you mean?",
    );
    expect(messages[0]).toEqual({
      role: "system",
      content: CLARIFY_JUDGE_RUBRIC,
    });
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toContain(
      "User request:\nChange the title to 'Overview'",
    );
    expect(messages[1].content).toContain(
      "Assistant reply:\nWhich slide do you mean?",
    );
  });

  it("tells the judge that confirming one guessed slide fails", () => {
    expect(CLARIFY_JUDGE_RUBRIC).toMatch(/picks or assumes one specific slide/);
  });

  it("accepts asking what to change for a request that could cover the whole deck", () => {
    expect(CLARIFY_JUDGE_RUBRIC).toMatch(
      /could apply to the whole deck[\s\S]*asks what the user wants changed, without picking or assuming a specific slide/,
    );
  });
});

describe("parseJudgeVerdict", () => {
  it("parses pass and fail", () => {
    expect(parseJudgeVerdict('{"verdict":"pass","reason":"asks"}')).toEqual({
      pass: true,
      reason: "asks",
    });
    expect(parseJudgeVerdict('{"verdict":"fail","reason":"guesses"}')).toEqual({
      pass: false,
      reason: "guesses",
    });
  });

  it("reports invalid JSON and unexpected shapes as errors", () => {
    expect(parseJudgeVerdict("not json")).toEqual({
      error: "judge returned invalid JSON",
    });
    expect(parseJudgeVerdict('{"verdict":"maybe","reason":"x"}')).toEqual({
      error: "judge returned an unexpected shape",
    });
  });
});

describe("judgeClarifyReply", () => {
  it("calls the judge model at temperature 0 with structured output", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        { message: { content: '{"verdict":"pass","reason":"asks which"}' } },
      ],
      usage: { prompt_tokens: 210, completion_tokens: 15, total_tokens: 225 },
    });

    const result = await judgeClarifyReply("msg", "reply", fakeClient(create));

    const request = create.mock.calls[0][0];
    expect(request.model).toBe(JUDGE_MODEL);
    expect(request.temperature).toBe(0);
    expect(request.response_format.type).toBe("json_schema");
    expect(result).toEqual({
      model: JUDGE_MODEL,
      pass: true,
      reason: "asks which",
      usage: { promptTokens: 210, completionTokens: 15, totalTokens: 225 },
    });
  });

  it("returns an error instead of throwing", async () => {
    const create = vi.fn().mockRejectedValue(new Error("rate limited"));
    expect(await judgeClarifyReply("m", "r", fakeClient(create))).toEqual({
      model: JUDGE_MODEL,
      error: "rate limited",
    });
  });

  it("keeps the usage when the verdict can't be parsed", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "oops" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    const result = await judgeClarifyReply("m", "r", fakeClient(create));
    expect(result.error).toBe("judge returned invalid JSON");
    expect(result.usage?.totalTokens).toBe(2);
  });
});
