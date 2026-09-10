import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();

vi.mock("./openaiClient", () => ({
  getOpenAIClient: () => ({
    chat: { completions: { create: mockCreate } },
  }),
  OPENAI_MODEL: "gpt-4o",
}));

import { generateDeckStreamed } from "./generateDeckStream";

function makeChunkStream(deltas: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const delta of deltas) {
        yield { choices: [{ delta: { content: delta } }] };
      }
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
    const deck = await generateDeckStreamed("Create a deck", (slide) => {
      emitted.push(slide.title);
    });

    expect(emitted).toEqual(["Q3 Roadmap", "Objectives"]);
    expect(deck.title).toBe("Q3 Roadmap");
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides.map((s) => s.title)).toEqual(emitted);
  });

  it("the final deck reuses the exact same slide objects (ids) streamed via onSlide", async () => {
    mockCreate.mockResolvedValue(makeChunkStream(chunkString(deckJson, 13)));

    const streamedIds: string[] = [];
    const deck = await generateDeckStreamed("Create a deck", (slide) => {
      streamedIds.push(slide.id);
    });

    expect(deck.slides.map((s) => s.id)).toEqual(streamedIds);
  });

  it("normalizes streamed slides (null column/layout become undefined)", async () => {
    mockCreate.mockResolvedValue(makeChunkStream([deckJson]));

    const deck = await generateDeckStreamed("Create a deck", () => {});

    expect(deck.slides[1].body[0]).toMatchObject({
      type: "bullets",
      items: ["Grow", "Ship"],
      column: undefined,
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
