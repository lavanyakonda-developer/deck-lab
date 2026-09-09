import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Deck, Slide } from "@/lib/schema/slide";

const mockCreate = vi.fn();
const mockGenerateDeckStreamed = vi.fn();

vi.mock("@/lib/ai/openaiClient", () => ({
  getOpenAIClient: () => ({
    chat: { completions: { create: mockCreate } },
  }),
  OPENAI_MODEL: "gpt-4o",
}));

vi.mock("@/lib/ai/generateDeckStream", () => ({
  generateDeckStreamed: (prompt: string, onSlide: (slide: Slide) => void) =>
    mockGenerateDeckStreamed(prompt, onSlide),
}));

import { POST } from "./route";

const deck: Deck = {
  id: "deck-1",
  title: "Q3 Roadmap",
  slides: [
    { id: "a", type: "title", title: "Q3 Roadmap", body: [], speakerNotes: "" },
    {
      id: "b",
      type: "content",
      title: "Objectives",
      body: [],
      speakerNotes: "",
    },
    {
      id: "c",
      type: "content",
      title: "Conclusion",
      body: [],
      speakerNotes: "",
    },
  ],
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function readSSE(
  response: Response,
): Promise<Array<{ event: string; data: unknown }>> {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event: "))!;
      const dataLine = lines.find((l) => l.startsWith("data: "))!;
      return {
        event: eventLine.slice("event: ".length),
        data: JSON.parse(dataLine.slice("data: ".length)),
      };
    });
}

// Simulates a realistic streaming response: text arrives in fragments,
// each tool call's arguments dribble in across several chunks.
function makeChunkStream(deltas: Array<Record<string, unknown>>) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const delta of deltas) {
        yield { choices: [{ delta }] };
      }
    },
  };
}

function textDeltas(text: string, size = 4): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (let i = 0; i < text.length; i += size) {
    out.push({ content: text.slice(i, i + size) });
  }
  return out;
}

function toolCallDeltas(
  index: number,
  name: string,
  args: unknown,
  chunkSize = 5,
): Array<Record<string, unknown>> {
  const argsJson = JSON.stringify(args);
  const out: Array<Record<string, unknown>> = [
    {
      tool_calls: [
        {
          index,
          id: `call_${index}`,
          type: "function",
          function: { name, arguments: "" },
        },
      ],
    },
  ];
  for (let i = 0; i < argsJson.length; i += chunkSize) {
    out.push({
      tool_calls: [
        { index, function: { arguments: argsJson.slice(i, i + chunkSize) } },
      ],
    });
  }
  return out;
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockGenerateDeckStreamed.mockReset();
  });

  it("streams text-delta events for a plain text (clarifying question) reply", async () => {
    mockCreate.mockResolvedValue(
      makeChunkStream(textDeltas("Which slide do you mean?")),
    );

    const response = await POST(
      makeRequest({ message: "make it better", deck }),
    );
    const events = await readSSE(response);

    const textEvents = events.filter((e) => e.event === "text-delta");
    expect(textEvents.length).toBeGreaterThan(1); // actually streamed, not one blob
    expect(
      textEvents.map((e) => (e.data as { text: string }).text).join(""),
    ).toBe("Which slide do you mean?");
    expect(events.at(-1)).toEqual({
      event: "done",
      data: { reply: "Which slide do you mean?" },
    });
  });

  it("emits a tool-call event as soon as a single tool call's arguments complete", async () => {
    mockCreate.mockResolvedValue(
      makeChunkStream(toolCallDeltas(0, "delete_slide", { id: "b" })),
    );

    const response = await POST(
      makeRequest({ message: "delete slide 2", deck }),
    );
    const events = await readSSE(response);

    expect(events).toEqual([
      { event: "tool-call", data: { tool: "delete_slide", args: { id: "b" } } },
      { event: "done", data: { reply: "Done — deleted a slide." } },
    ]);
    expect(mockGenerateDeckStreamed).not.toHaveBeenCalled();
  });

  it("emits multiple tool-call events, one per completed tool call, for a multi-tool turn", async () => {
    const changeLayoutArgs = { id: "b", type: "table", layout: null };
    const updateSlideArgs = {
      id: "b",
      title: null,
      subtitle: null,
      body: [{ type: "table", headers: ["A"], rows: [["1"]], column: null }],
      layout: null,
      speakerNotes: null,
    };
    mockCreate.mockResolvedValue(
      makeChunkStream([
        ...toolCallDeltas(0, "change_layout", changeLayoutArgs),
        ...toolCallDeltas(1, "update_slide", updateSlideArgs),
      ]),
    );

    const response = await POST(
      makeRequest({ message: "change slide 2 to a table", deck }),
    );
    const events = await readSSE(response);

    const toolCallEvents = events.filter((e) => e.event === "tool-call");
    expect(toolCallEvents).toHaveLength(2);
    expect(toolCallEvents[0].data).toEqual({
      tool: "change_layout",
      args: changeLayoutArgs,
    });
    expect(toolCallEvents[1].data).toEqual({
      tool: "update_slide",
      args: updateSlideArgs,
    });
    expect(events.at(-1)?.event).toBe("done");
  });

  it("drops an invalid tool call silently (no tool-call event) but the stream still completes", async () => {
    mockCreate.mockResolvedValue(
      // missing required "id"
      makeChunkStream(toolCallDeltas(0, "delete_slide", {})),
    );
    const response = await POST(
      makeRequest({ message: "delete slide 2", deck }),
    );
    const events = await readSSE(response);
    expect(events.filter((e) => e.event === "tool-call")).toHaveLength(0);
    expect(events.at(-1)).toEqual({
      event: "done",
      data: { reply: "I didn't make any changes." },
    });
  });

  it("intercepts generate_deck and streams slide events, then done with generatedDeck", async () => {
    mockCreate.mockResolvedValue(
      makeChunkStream(
        toolCallDeltas(0, "generate_deck", {
          prompt: "Create a deck about coffee",
        }),
      ),
    );
    const generated: Deck = {
      id: "deck-2",
      title: "Coffee",
      slides: [
        { id: "x", type: "title", title: "Coffee", body: [], speakerNotes: "" },
        {
          id: "y",
          type: "content",
          title: "Origins",
          body: [],
          speakerNotes: "",
        },
      ],
    };
    mockGenerateDeckStreamed.mockImplementation(async (_prompt, onSlide) => {
      for (const slide of generated.slides) onSlide(slide);
      return generated;
    });

    const response = await POST(
      makeRequest({ message: "Create a deck about coffee", deck }),
    );
    const events = await readSSE(response);

    expect(mockGenerateDeckStreamed).toHaveBeenCalledWith(
      "Create a deck about coffee",
      expect.any(Function),
    );
    expect(events.filter((e) => e.event === "tool-call")).toHaveLength(0);
    expect(events.filter((e) => e.event === "slide")).toEqual([
      { event: "slide", data: generated.slides[0] },
      { event: "slide", data: generated.slides[1] },
    ]);
    const done = events.at(-1)!;
    expect(done.event).toBe("done");
    expect((done.data as { generatedDeck: Deck }).generatedDeck).toEqual(
      generated,
    );
    expect((done.data as { reply: string }).reply).toContain("Coffee");
  });

  it("passes the deck context (including slide ids) and prior history to OpenAI", async () => {
    mockCreate.mockResolvedValue(makeChunkStream([]));
    await POST(
      makeRequest({
        message: "3rd slide",
        deck,
        history: [
          { role: "user", content: "can you change it to table" },
          { role: "assistant", content: "Which slide?" },
        ],
      }),
    );

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.stream).toBe(true);
    expect(callArgs.messages).toEqual([
      expect.objectContaining({ role: "system" }),
      { role: "user", content: "can you change it to table" },
      { role: "assistant", content: "Which slide?" },
      { role: "user", content: "3rd slide" },
    ]);
    const systemMessage = callArgs.messages[0];
    expect(systemMessage.content).toContain('id="b"');
    expect(systemMessage.content).toContain("Objectives");
  });

  it("marks the currently selected slide in the deck context so the model can identify it", async () => {
    mockCreate.mockResolvedValue(makeChunkStream([]));
    await POST(
      makeRequest({
        message: "change title to JS Components",
        deck,
        selectedSlideId: "b",
      }),
    );

    const callArgs = mockCreate.mock.calls[0][0];
    const systemMessage = callArgs.messages[0];
    expect(systemMessage.content).toMatch(
      /id="b"[^\n]*\(currently selected\/viewed by the user\)/,
    );
    expect(systemMessage.content).not.toMatch(
      /id="a"[^\n]*\(currently selected/,
    );
  });

  it("instructs the model to confirm before editing an unqualified request's implied slide, rather than applying it directly", async () => {
    mockCreate.mockResolvedValue(makeChunkStream([]));
    await POST(
      makeRequest({
        message: "change title to JS Components",
        deck,
        selectedSlideId: "b",
      }),
    );

    const callArgs = mockCreate.mock.calls[0][0];
    const instructions = callArgs.messages[0].content.split("Current deck:")[0];
    expect(instructions).toMatch(/do NOT call a tool yet/i);
    expect(instructions).toMatch(/ask for confirmation/i);
    expect(instructions).not.toMatch(/apply the change to that slide/i);
  });

  it("instructs the model to trust the fresh deck context over its own earlier statements in history", async () => {
    mockCreate.mockResolvedValue(makeChunkStream([]));
    await POST(makeRequest({ message: "what is the title of slide 2?", deck }));

    const callArgs = mockCreate.mock.calls[0][0];
    const instructions = callArgs.messages[0].content.split("Current deck:")[0];
    expect(instructions).toMatch(/always the true, up-to-date state/i);
    expect(instructions).toMatch(
      /manual edits the user made directly on the canvas/i,
    );
    expect(instructions).toMatch(
      /even if it contradicts what you said in an earlier turn/i,
    );
  });

  it("instructs the model to re-resolve a named slide number fresh every turn, not reuse an earlier mapping", async () => {
    mockCreate.mockResolvedValue(makeChunkStream([]));
    await POST(makeRequest({ message: "what is title on slide 4", deck }));

    const callArgs = mockCreate.mock.calls[0][0];
    const instructions = callArgs.messages[0].content.split("Current deck:")[0];
    expect(instructions).toMatch(/is NOT a stable identifier/i);
    expect(instructions).toMatch(
      /never reuse an id you associated with "slide N" in an earlier reply/i,
    );
  });

  it("treats a missing selectedSlideId as no slide selected rather than failing", async () => {
    mockCreate.mockResolvedValue(makeChunkStream([]));
    const response = await POST(
      makeRequest({ message: "Delete slide 2", deck }),
    );
    expect(response.status).toBe(200);
    const callArgs = mockCreate.mock.calls[0][0];
    // The static instructions themselves mention "currently selected" (as
    // the rule describing the feature) - what matters is that no slide
    // *line* in the deck context is marked with it.
    const deckContextSection =
      callArgs.messages[0].content.split("Current deck:")[1];
    expect(deckContextSection).not.toContain("currently selected");
  });

  it("rejects an empty message with 400 and never starts streaming", async () => {
    const response = await POST(makeRequest({ message: "   ", deck }));
    expect(response.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects a missing/invalid deck with 400", async () => {
    const response = await POST(
      makeRequest({ message: "Delete slide 2", deck: { bad: true } }),
    );
    expect(response.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON with 400", async () => {
    const response = await POST(makeRequest("not json"));
    expect(response.status).toBe(400);
  });

  it("emits an error SSE event (HTTP 200) when the OpenAI call fails", async () => {
    mockCreate.mockRejectedValue(new Error("OpenAI is down"));
    const response = await POST(
      makeRequest({ message: "Delete slide 2", deck }),
    );
    expect(response.status).toBe(200);
    const events = await readSSE(response);
    expect(events).toEqual([
      { event: "error", data: { error: "OpenAI is down" } },
    ]);
  });
});
