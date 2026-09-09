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

Keep bullet items short (a few words to one short sentence). Keep the deck coherent as a whole - it should read like one presentation, not unrelated slides. Unless the user specifies a slide count, use your judgment for a reasonable, focused deck (typically 4-8 slides).`;

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
