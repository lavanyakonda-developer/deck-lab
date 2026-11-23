import type { Deck } from "@/lib/schema/slide";
import { getSlideTitle } from "@/lib/slides/layoutEngine";
import type { EditCase, EditRunScore } from "./editCases";
import { judgeClarifyReply, type JudgeResult } from "./judge";

export interface StrictClarifyResult {
  correct: boolean;
  // "rule" when a slide was selected, "judge" when none was.
  method: "rule" | "judge";
  reason: string;
  judge?: JudgeResult;
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Whether `reply` names slide `number` (as "slide 3") and its title.
export function namesSlide(
  reply: string,
  number: number,
  title: string,
): { number: boolean; title: boolean } {
  return {
    number: new RegExp(`\\bslide\\s*#?\\s*${number}\\b`, "i").test(reply),
    title: ` ${normalize(reply)} `.includes(` ${normalize(title)} `),
  };
}

// The stricter reading of a clarify case, alongside the lenient
// clarifyCorrect ("no tool call and a question mark"):
// - a slide is selected: the reply must name that slide's number and title
//   (the system prompt asks for exactly this confirmation), with no tool call;
// - no slide is selected: an LLM judge decides whether the reply asks which
//   slide the user means, rather than guessing one.
export async function scoreStrictClarify(
  testCase: EditCase,
  score: EditRunScore,
  deck: Deck,
  judge: typeof judgeClarifyReply = judgeClarifyReply,
): Promise<StrictClarifyResult> {
  const method = testCase.selectedSlideId ? "rule" : "judge";
  if (score.error) {
    return { correct: false, method, reason: `run failed: ${score.error}` };
  }
  if (score.calls.length > 0) {
    return { correct: false, method, reason: "made a tool call" };
  }

  if (testCase.selectedSlideId) {
    const index = deck.slides.findIndex(
      (s) => s.id === testCase.selectedSlideId,
    );
    if (index === -1) {
      throw new Error(`Unknown selected slide ${testCase.selectedSlideId}`);
    }
    const title = getSlideTitle(deck.slides[index]);
    const named = namesSlide(score.reply, index + 1, title);
    const missing = [
      ...(named.number ? [] : [`slide ${index + 1}`]),
      ...(named.title ? [] : [`"${title}"`]),
    ];
    return missing.length === 0
      ? { correct: true, method, reason: "names the selected slide" }
      : {
          correct: false,
          method,
          reason: `does not name ${missing.join(" or ")}`,
        };
  }

  const verdict = await judge(testCase.message, score.reply);
  return {
    correct: verdict.pass === true,
    method,
    reason: verdict.error
      ? `judge error: ${verdict.error}`
      : (verdict.reason ?? ""),
    judge: verdict,
  };
}
