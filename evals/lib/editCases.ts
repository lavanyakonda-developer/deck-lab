import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { ValidatedToolCall } from "@/lib/ai/tools";
import type { Deck } from "@/lib/schema/slide";
import { getSlideContent } from "@/lib/slides/layoutEngine";
import { changedNonTargetSlides } from "./compare";
import { claimedSelection } from "./inventedSelection";
import { eventsOfType, type SSEResult } from "./sse";
import type { StrictClarifyResult } from "./strictClarify";

// --- Case file format ------------------------------------------------------

// One expected tool call. At most one target field applies per tool:
// - slideId: update_slide / delete_slide / change_layout must use this id
// - position: add_slide's new slide must end up at this 1-based position
//   in the resulting deck ("end" = last)
// - order: reorder_slides must leave the deck in exactly this id order
const ExpectedCallSchema = z.object({
  tool: z.enum([
    "generate_deck",
    "add_slide",
    "update_slide",
    "delete_slide",
    "reorder_slides",
    "change_layout",
  ]),
  slideId: z.string().optional(),
  position: z.union([z.number().int().min(1), z.literal("end")]).optional(),
  order: z.array(z.string()).optional(),
});
export type ExpectedCall = z.infer<typeof ExpectedCallSchema>;

const ToolExpectationSchema = z.object({
  // Every one of these must be called (in any order).
  tools: z.array(ExpectedCallSchema).min(1),
  // May also be called without counting as a wrong tool - e.g. the
  // update_slide the system prompt asks for alongside change_layout when
  // content needs reshaping. Their targets are still checked if called.
  optional: z.array(ExpectedCallSchema).optional(),
  // Content check on the resulting deck (e.g. "bullets into a table").
  resultHasBlock: z
    .object({
      slideId: z.string(),
      type: z.enum(["bullets", "paragraph", "table", "chart", "image"]),
    })
    .optional(),
});

export type ToolExpectation = z.infer<typeof ToolExpectationSchema>;

const ClarifyExpectationSchema = z.object({ clarify: z.literal(true) });

const EditCaseSchema = z.object({
  id: z.string(),
  category: z.string(),
  message: z.string(),
  selectedSlideId: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
  // Shorthand { tool, slideId } is accepted for the common single-call case.
  expect: z.union([
    ClarifyExpectationSchema,
    ToolExpectationSchema,
    ExpectedCallSchema.transform((call): ToolExpectation => ({
      tools: [call],
    })),
  ]),
});
export type EditCase = z.infer<typeof EditCaseSchema>;

export function loadEditCases(): EditCase[] {
  const file = path.join(import.meta.dirname, "..", "cases", "edit-cases.json");
  const cases = z
    .array(EditCaseSchema)
    .parse(JSON.parse(readFileSync(file, "utf8")));
  const ids = new Set<string>();
  for (const c of cases) {
    if (ids.has(c.id)) throw new Error(`Duplicate case id: ${c.id}`);
    ids.add(c.id);
  }
  return cases;
}

export function isClarifyCase(
  c: EditCase,
): c is EditCase & { expect: { clarify: true } } {
  return "clarify" in c.expect;
}

// The expected tool calls, or null for a clarify case.
export function toolExpectation(c: EditCase): ToolExpectation | null {
  return "clarify" in c.expect ? null : c.expect;
}

// --- Scoring ---------------------------------------------------------------

export interface ActualCall {
  tool: ValidatedToolCall["tool"];
  // Short human-readable form, e.g. "update_slide(slide-2)".
  label: string;
  args?: unknown;
}

export interface EditRunScore {
  caseId: string;
  category: string;
  kind: "tool" | "clarify";
  calls: string[];
  // Calls the server rejected, as "tool: validation error".
  invalidCalls: string[];
  reply: string;
  // Only for cases sent with no selected slide: the phrase in the reply
  // that claims a slide is selected anyway (see inventedSelection.ts).
  inventedSelection?: string;
  latencyMs: number;
  error?: string;
  // Tool cases only.
  toolCorrect?: boolean;
  targetCorrect?: boolean;
  // Only when the response actually changed something.
  preserved?: boolean;
  // No tool call and no rejected call: the model only replied in text.
  answeredInText?: boolean;
  // At least one call was rejected by validation (see invalidCalls).
  invalidCall?: boolean;
  // Clarify cases only.
  clarifyCorrect?: boolean;
  // Set by the runner after scoring (it may call an LLM judge).
  strictClarify?: StrictClarifyResult;
  passed: boolean;
  problems: string[];
}

function describeCall(call: ValidatedToolCall): string {
  switch (call.tool) {
    case "update_slide":
    case "delete_slide":
    case "change_layout":
      return `${call.tool}(${call.args.id})`;
    case "add_slide":
      return `add_slide(index=${call.args.index ?? "end"})`;
    case "reorder_slides":
      return `reorder_slides([${call.args.orderedIds.join(", ")}])`;
    case "generate_deck":
      return "generate_deck";
  }
}

function describeExpected(call: ExpectedCall): string {
  const target =
    call.slideId ??
    (call.position !== undefined ? `position ${call.position}` : undefined) ??
    (call.order ? `[${call.order.join(", ")}]` : undefined);
  return target ? `${call.tool}(${target})` : call.tool;
}

// Everything the response asked the deck to do, in arrival order. A
// generated deck counts as a generate_deck call.
export function actualCalls(result: SSEResult): ActualCall[] {
  const calls: ActualCall[] = eventsOfType<ValidatedToolCall>(
    result.events,
    "tool-call",
  ).map((call) => ({
    tool: call.tool,
    label: describeCall(call),
    args: call.args,
  }));
  const done = eventsOfType<{ generatedDeck?: Deck }>(result.events, "done")[0];
  if (done?.generatedDeck) {
    calls.push({ tool: "generate_deck", label: "generate_deck" });
  }
  return calls;
}

function targetMatches(
  expected: ExpectedCall,
  actual: ActualCall,
  before: Deck,
  after: Deck,
): boolean {
  if (expected.slideId !== undefined) {
    return (
      (actual.args as { id?: string } | undefined)?.id === expected.slideId
    );
  }
  if (expected.position !== undefined) {
    const beforeIds = new Set(before.slides.map((s) => s.id));
    const newIndex = after.slides.findIndex((s) => !beforeIds.has(s.id));
    if (newIndex === -1) return false;
    return expected.position === "end"
      ? newIndex === after.slides.length - 1
      : newIndex === expected.position - 1;
  }
  if (expected.order !== undefined) {
    const order = after.slides.map((s) => s.id);
    return (
      order.length === expected.order.length &&
      order.every((id, i) => id === expected.order![i])
    );
  }
  return true;
}

// Pairs each expected call with an actual call of the same tool, preferring
// one whose target is right, so a correct call isn't "used up" by matching
// it against the wrong expectation.
function matchCalls(
  expectation: ToolExpectation,
  calls: ActualCall[],
  before: Deck,
  after: Deck,
) {
  const unused = new Set(calls.map((_, i) => i));
  const missing: ExpectedCall[] = [];
  const wrongTarget: Array<{ expected: ExpectedCall; actual: ActualCall }> = [];

  const take = (expected: ExpectedCall, required: boolean) => {
    const sameTool = [...unused].filter((i) => calls[i].tool === expected.tool);
    const exact = sameTool.find((i) =>
      targetMatches(expected, calls[i], before, after),
    );
    const chosen = exact ?? sameTool[0];
    if (chosen === undefined) {
      if (required) missing.push(expected);
      return;
    }
    unused.delete(chosen);
    if (exact === undefined) {
      wrongTarget.push({ expected, actual: calls[chosen] });
    }
  };

  for (const expected of expectation.tools) take(expected, true);
  for (const expected of expectation.optional ?? []) take(expected, false);

  return {
    missing,
    wrongTarget,
    unexpected: [...unused].map((i) => calls[i]),
  };
}

function hasBlock(
  deck: Deck,
  slideId: string,
  type: string,
): boolean | undefined {
  const slide = deck.slides.find((s) => s.id === slideId);
  if (!slide) return undefined;
  return getSlideContent(slide).body.some((block) => block.type === type);
}

// Scores one run of one case. `after` is the deck produced by applying the
// response through the deck store (see applyChatEvents).
export function scoreEditRun(
  testCase: EditCase,
  before: Deck,
  result: SSEResult,
  after: Deck,
): EditRunScore {
  const calls = actualCalls(result);
  const done = eventsOfType<{ reply?: string }>(result.events, "done")[0];
  const errorEvent = eventsOfType<{ error: string }>(result.events, "error")[0];
  const error =
    errorEvent?.error ??
    (result.httpError
      ? `HTTP ${result.status}: ${result.httpError}`
      : undefined) ??
    (done ? undefined : "stream ended without a done event");

  const base = {
    caseId: testCase.id,
    category: testCase.category,
    calls: calls.map((c) => c.label),
    invalidCalls: eventsOfType<{ tool: string; error: string }>(
      result.events,
      "invalid-tool-call",
    ).map((c) => `${c.tool}: ${c.error}`),
    reply: done?.reply ?? "",
    inventedSelection: testCase.selectedSlideId
      ? undefined
      : claimedSelection(done?.reply ?? ""),
    latencyMs:
      result.events.find((e) => e.event === "done")?.t ?? result.totalMs,
    error,
  };
  const problems: string[] = error ? [`error: ${error}`] : [];

  if (isClarifyCase(testCase)) {
    const asked = base.reply.includes("?");
    if (calls.length > 0) problems.push("changed the deck instead of asking");
    if (!asked) problems.push("reply contains no question");
    const clarifyCorrect = !error && calls.length === 0 && asked;
    return {
      ...base,
      kind: "clarify",
      clarifyCorrect,
      passed: clarifyCorrect,
      problems,
    };
  }

  const expectation = toolExpectation(testCase)!;
  const { missing, wrongTarget, unexpected } = matchCalls(
    expectation,
    calls,
    before,
    after,
  );
  for (const m of missing) problems.push(`missing ${describeExpected(m)}`);
  for (const { expected, actual } of wrongTarget) {
    problems.push(
      `wrong target: ${actual.label}, expected ${describeExpected(expected)}`,
    );
  }
  for (const u of unexpected) problems.push(`unexpected ${u.label}`);

  let blockCheck = true;
  if (expectation.resultHasBlock) {
    const { slideId, type } = expectation.resultHasBlock;
    blockCheck = hasBlock(after, slideId, type) === true;
    if (!blockCheck)
      problems.push(`${slideId} has no ${type} block afterwards`);
  }

  // Preservation only means something if the deck was actually changed.
  let preserved: boolean | undefined;
  if (calls.length > 0) {
    const targetIds = [
      ...expectation.tools,
      ...(expectation.optional ?? []),
    ].flatMap((call) => (call.slideId ? [call.slideId] : []));
    if (expectation.resultHasBlock)
      targetIds.push(expectation.resultHasBlock.slideId);
    const changed = changedNonTargetSlides(before, after, targetIds);
    preserved = changed.length === 0;
    if (!preserved)
      problems.push(`changed untargeted slides: ${changed.join(", ")}`);
  }

  const toolCorrect = !error && missing.length === 0 && unexpected.length === 0;
  const targetCorrect =
    !error && missing.length === 0 && wrongTarget.length === 0 && blockCheck;
  const invalidCall = !error && base.invalidCalls.length > 0;
  for (const invalid of base.invalidCalls) {
    problems.push(`invalid tool call rejected: ${invalid}`);
  }
  const answeredInText = !error && calls.length === 0 && !invalidCall;
  if (answeredInText) problems.push("no tool call arrived (answered in text)");

  return {
    ...base,
    kind: "tool",
    toolCorrect,
    targetCorrect,
    preserved,
    answeredInText,
    invalidCall,
    passed: toolCorrect && targetCorrect && preserved !== false,
    problems,
  };
}
