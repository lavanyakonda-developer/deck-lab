import type { Deck } from "@/lib/schema/slide";
import { DeckSchema } from "@/lib/schema/slide";
import { deckJsonSchema } from "./deckJsonSchema";
import { GeneratedDeckSchema } from "./deckGenerationSchema";
import { normalizeGeneratedDeck } from "./normalizeGeneratedDeck";
import { getOpenAIClient, OPENAI_MODEL } from "./openaiClient";

export const DECK_GENERATION_SYSTEM_PROMPT = `You create presentation decks as structured JSON. Produce clear, coherent, well-organized slides with concise titles and body content appropriate to each slide's type.

Choose slide types thoughtfully:
- "title": the opening slide (a short title + optional subtitle, empty body).
- "content": a single column of bullets and/or short paragraphs.
- "two-column": side-by-side content, using each body block's "column" (0 or 1) to place it left or right; set layout.columnTitles for the two headers.
- "comparison": contrasting exactly two things, same column convention as two-column.
- "table": tabular data, using a single "table" body block.

Keep bullet items short (a few words to one short sentence). Keep the deck coherent as a whole - it should read like one presentation, not unrelated slides. Unless the user specifies a slide count, use your judgment for a reasonable, focused deck (typically 4-8 slides).

Body content blocks: "bullets" and "paragraph" are the default for most slides. Use a "table" block for genuinely tabular data.

Required deck structure - every deck you generate must follow this shape, regardless of topic:
1. A "title" slide first.
2. Somewhere in the middle: at least one slide whose body includes a "chart" block, and at least one (different) slide whose body includes an "image" block. Exactly one of each by default - don't add a chart or image to every slide, and don't skip either one.
3. A dedicated closing slide LAST - a brief summary, key takeaway, or "thank you" / "questions" slide. The chart slide and the image slide must both come BEFORE this closing slide, never be the closing slide themselves, and never be the last slide of the deck.

Rules for the chart and image blocks specifically:
- "chart" block: chartType "bar"/"line"/"pie", data as [{label, value}] - use real, sensible numbers relevant to the deck's topic (invent plausible illustrative figures if the user didn't supply real data).
- "image" block: only "alt" describing a relevant image for the topic - never a "url", you don't generate the actual image yourself; it's generated afterward via a separate slow call and shows a placeholder until then, so one image slide is enough.`;

export async function generateDeckFromPrompt(prompt: string): Promise<Deck> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: DECK_GENERATION_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: deckJsonSchema,
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI returned an empty response");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned a response that was not valid JSON");
  }

  const generated = GeneratedDeckSchema.safeParse(parsedJson);
  if (!generated.success) {
    throw new Error(
      `OpenAI response failed schema validation: ${generated.error.message}`,
    );
  }

  const deck = normalizeGeneratedDeck(generated.data);

  const validated = DeckSchema.safeParse(deck);
  if (!validated.success) {
    throw new Error(
      `Normalized deck failed schema validation: ${validated.error.message}`,
    );
  }

  return validated.data;
}
