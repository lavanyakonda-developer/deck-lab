import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSlideContent, getSlideTitle } from "@/lib/slides/layoutEngine";

const mockCreate = vi.fn();

vi.mock("./openaiClient", () => ({
  getOpenAIClient: () => ({
    chat: { completions: { create: mockCreate } },
  }),
  OPENAI_MODEL: "gpt-4o",
}));

import { generateDeckStreamed } from "./generateDeckStream";

function makeChunkStream(deltas: string[], usage?: Record<string, number>) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const delta of deltas) {
        yield { choices: [{ delta: { content: delta } }] };
      }
      // With stream_options.include_usage, usage arrives on a final chunk
      // that has no choices.
      if (usage) yield { choices: [], usage };
    },
  };
}

function chunkString(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

const deckJson = JSON.stringify({
  title: "Q3 Roadmap",
  slides: [
    {
      type: "title",
      title: "Q3 Roadmap",
      subtitle: null,
      body: [],
      layout: null,
    },
    {
      type: "content",
      title: "Objectives",
      subtitle: null,
      body: [{ type: "bullets", items: ["Grow", "Ship"], column: null }],
      layout: null,
    },
  ],
});

describe("generateDeckStreamed", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("emits each slide via onSlide as soon as it streams in, before the promise resolves", async () => {
    mockCreate.mockResolvedValue(makeChunkStream(chunkString(deckJson, 9)));

    const emitted: string[] = [];
    const { deck } = await generateDeckStreamed("Create a deck", (slide) => {
      emitted.push(getSlideTitle(slide));
    });

    expect(emitted).toEqual(["Q3 Roadmap", "Objectives"]);
    expect(deck.title).toBe("Q3 Roadmap");
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides.map(getSlideTitle)).toEqual(emitted);
  });

  it("the final deck reuses the exact same slide objects (ids) streamed via onSlide", async () => {
    mockCreate.mockResolvedValue(makeChunkStream(chunkString(deckJson, 13)));

    const streamedIds: string[] = [];
    const { deck } = await generateDeckStreamed("Create a deck", (slide) => {
      streamedIds.push(slide.id);
    });

    expect(deck.slides.map((s) => s.id)).toEqual(streamedIds);
  });

  it("normalizes streamed slides (null column/layout become undefined)", async () => {
    mockCreate.mockResolvedValue(makeChunkStream([deckJson]));

    const { deck } = await generateDeckStreamed("Create a deck", () => {});

    expect(getSlideContent(deck.slides[1]).body[0]).toMatchObject({
      type: "bullets",
      items: ["Grow", "Ship"],
      column: undefined,
    });
  });

  it("requests usage on the stream and returns it alongside the deck", async () => {
    mockCreate.mockResolvedValue(
      makeChunkStream(chunkString(deckJson, 9), {
        prompt_tokens: 500,
        completion_tokens: 200,
        total_tokens: 700,
      }),
    );

    const { usage } = await generateDeckStreamed("Create a deck", () => {});

    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
    });
    expect(usage).toEqual({
      promptTokens: 500,
      completionTokens: 200,
      totalTokens: 700,
    });
  });

  it("throws if the final response is not valid JSON", async () => {
    mockCreate.mockResolvedValue(makeChunkStream(["not json"]));
    await expect(
      generateDeckStreamed("Create a deck", () => {}),
    ).rejects.toThrow(/not valid JSON/);
  });

  it("throws if the final response fails schema validation", async () => {
    mockCreate.mockResolvedValue(
      makeChunkStream([JSON.stringify({ title: "X", slides: [] })]),
    );
    await expect(
      generateDeckStreamed("Create a deck", () => {}),
    ).rejects.toThrow(/schema validation/);
  });
});
