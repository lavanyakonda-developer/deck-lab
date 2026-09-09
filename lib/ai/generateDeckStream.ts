import { createId } from "@/lib/id";
import type { Deck, Slide } from "@/lib/schema/slide";
import { deckJsonSchema } from "./deckJsonSchema";
import {
  GeneratedDeckSchema,
  SlideGeneratedSchema,
} from "./deckGenerationSchema";
import { DECK_GENERATION_SYSTEM_PROMPT } from "./generateDeck";
import { normalizeBlock, normalizeLayout } from "./normalize";
import { getOpenAIClient, OPENAI_MODEL } from "./openaiClient";
import { DeckSlideStreamParser } from "./streamParser";

// Streaming counterpart to generateDeckFromPrompt: emits each slide via
// onSlide as soon as it's fully streamed, parsed, and validated - well
// before the whole response finishes - then resolves with the complete
// Deck. The returned Deck reuses the exact same Slide objects (same ids)
// already handed to onSlide, so a caller applying them live never sees a
// second, different set of slides once the promise resolves.
export async function generateDeckStreamed(
  prompt: string,
  onSlide: (slide: Slide) => void,
): Promise<Deck> {
  const client = getOpenAIClient();
  const parser = new DeckSlideStreamParser();
  const slides: Slide[] = [];
  let raw = "";

  const stream = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: DECK_GENERATION_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: deckJsonSchema,
    },
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (!delta) continue;
    raw += delta;

    for (const rawSlide of parser.feed(delta)) {
      const parsed = SlideGeneratedSchema.safeParse(rawSlide);
      if (!parsed.success) continue; // final validation below catches real corruption
      const slide: Slide = {
        id: createId("slide"),
        type: parsed.data.type,
        title: parsed.data.title,
        subtitle: parsed.data.subtitle ?? undefined,
        body: parsed.data.body.map(normalizeBlock),
        layout: normalizeLayout(parsed.data.layout),
        speakerNotes: parsed.data.speakerNotes,
      };
      slides.push(slide);
      onSlide(slide);
    }
  }

  // Safety net: confirm the full raw response is well-formed and matches
  // what was streamed, catching a truncated/corrupted stream even though
  // individual slides looked fine in isolation.
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
  if (generated.data.slides.length !== slides.length) {
    throw new Error(
      "Streamed slide count did not match the final response - the stream may have been interrupted",
    );
  }

  return {
    id: createId("deck"),
    title: generated.data.title,
    slides,
  };
}
