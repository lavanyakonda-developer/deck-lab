import type OpenAI from "openai";
import { z } from "zod";
import { getOpenAIClient } from "@/lib/ai/openaiClient";
import { toTokenUsage, type TokenUsage } from "@/lib/ai/usage";
import { JUDGE_MODEL } from "../pricing";

// Grading rubric for an ambiguous request with no slide selected. The app's
// system prompt says to "ask which slide they mean instead of guessing".
export const CLARIFY_JUDGE_RUBRIC = `You grade one reply from the assistant of a presentation editor. The user's request did not say which slide it was about, and no slide was selected in the editor. The correct behaviour is to ask the user which slide they mean.

Answer "pass" only if the reply asks the user which slide they mean. It may list or suggest several candidate slides, as long as the choice is left to the user.
Answer "fail" if the reply picks or assumes one specific slide (even if it then asks the user to confirm that slide), makes or describes a change, asks only about something other than which slide, or asks nothing.

Respond with JSON: {"verdict": "pass" or "fail", "reason": one short sentence}.`;

const JUDGE_RESPONSE_SCHEMA = {
  name: "clarify_verdict",
  strict: true,
  schema: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["pass", "fail"] },
      reason: { type: "string" },
    },
    required: ["verdict", "reason"],
    additionalProperties: false,
  },
};

export function buildClarifyJudgeMessages(
  userMessage: string,
  reply: string,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return [
    { role: "system", content: CLARIFY_JUDGE_RUBRIC },
    {
      role: "user",
      content: `User request:\n${userMessage}\n\nAssistant reply:\n${reply}`,
    },
  ];
}

const VerdictSchema = z.object({
  verdict: z.enum(["pass", "fail"]),
  reason: z.string(),
});

export type ParsedVerdict =
  { pass: boolean; reason: string } | { error: string };

export function parseJudgeVerdict(content: string): ParsedVerdict {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return { error: "judge returned invalid JSON" };
  }
  const parsed = VerdictSchema.safeParse(json);
  if (!parsed.success) return { error: "judge returned an unexpected shape" };
  return { pass: parsed.data.verdict === "pass", reason: parsed.data.reason };
}

export interface JudgeResult {
  model: string;
  pass?: boolean;
  reason?: string;
  usage?: TokenUsage;
  error?: string;
}

// Asks the judge whether `reply` asks which slide `userMessage` refers to.
// Never throws: a failed call comes back with `error` set.
export async function judgeClarifyReply(
  userMessage: string,
  reply: string,
  client: Pick<OpenAI, "chat"> = getOpenAIClient(),
): Promise<JudgeResult> {
  try {
    const completion = await client.chat.completions.create({
      model: JUDGE_MODEL,
      temperature: 0,
      messages: buildClarifyJudgeMessages(userMessage, reply),
      response_format: {
        type: "json_schema",
        json_schema: JUDGE_RESPONSE_SCHEMA,
      },
    });
    const usage = toTokenUsage(completion.usage);
    const verdict = parseJudgeVerdict(
      completion.choices[0]?.message?.content ?? "",
    );
    return "error" in verdict
      ? { model: JUDGE_MODEL, usage, error: verdict.error }
      : { model: JUDGE_MODEL, usage, ...verdict };
  } catch (error) {
    return {
      model: JUDGE_MODEL,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
