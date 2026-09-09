import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Deck } from "@/lib/schema/slide";

const mockCreate = vi.fn();
const mockGenerateDeckFromPrompt = vi.fn();

vi.mock("@/lib/ai/openaiClient", () => ({
  getOpenAIClient: () => ({
    chat: { completions: { create: mockCreate } },
  }),
  OPENAI_MODEL: "gpt-4o",
}));

vi.mock("@/lib/ai/generateDeck", () => ({
  generateDeckFromPrompt: (prompt: string) =>
    mockGenerateDeckFromPrompt(prompt),
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

function toolCallResponse(
  calls: Array<{ name: string; args: unknown }>,
  content: string | null = null,
) {
  return {
    choices: [
      {
        message: {
          content,
          tool_calls: calls.map((call, i) => ({
            id: `call_${i}`,
            type: "function",
            function: { name: call.name, arguments: JSON.stringify(call.args) },
          })),
        },
      },
    ],
  };
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockGenerateDeckFromPrompt.mockReset();
  });

  it("returns a validated update_slide tool call for a targeted request", async () => {
    mockCreate.mockResolvedValue(
      toolCallResponse([
        {
          name: "update_slide",
          args: {
            id: "b",
            title: null,
            subtitle: null,
            body: [{ type: "paragraph", text: "Shorter.", column: null }],
            layout: null,
            speakerNotes: null,
          },
        },
      ]),
    );

    const response = await POST(
      makeRequest({ message: "Make slide 2 more concise", deck }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.toolCalls).toHaveLength(1);
    expect(body.toolCalls[0]).toMatchObject({
      tool: "update_slide",
      args: { id: "b" },
    });
  });

  it("passes the deck context (including slide ids) to OpenAI", async () => {
    mockCreate.mockResolvedValue(toolCallResponse([]));
    await POST(makeRequest({ message: "Make slide 2 more concise", deck }));

    const callArgs = mockCreate.mock.calls[0][0];
    const systemMessage = callArgs.messages.find(
      (m: { role: string }) => m.role === "system",
    );
    expect(systemMessage.content).toContain('id="b"');
    expect(systemMessage.content).toContain("Objectives");
    expect(callArgs.tools).toBeDefined();
  });

  it("includes prior conversation turns in the OpenAI messages array, in order, before the current message", async () => {
    mockCreate.mockResolvedValue(toolCallResponse([]));
    await POST(
      makeRequest({
        message: "3rd slide",
        deck,
        history: [
          { role: "user", content: "can you change it to table" },
          {
            role: "assistant",
            content: "Which slide would you like to change to a table?",
          },
        ],
      }),
    );

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages).toEqual([
      expect.objectContaining({ role: "system" }),
      { role: "user", content: "can you change it to table" },
      {
        role: "assistant",
        content: "Which slide would you like to change to a table?",
      },
      { role: "user", content: "3rd slide" },
    ]);
  });

  it("treats a missing history as no prior turns rather than failing", async () => {
    mockCreate.mockResolvedValue(toolCallResponse([]));
    const response = await POST(
      makeRequest({ message: "Delete slide 2", deck }),
    );
    expect(response.status).toBe(200);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(2); // system + current message only
  });

  it("intercepts generate_deck server-side and returns generatedDeck instead of a raw tool call", async () => {
    mockCreate.mockResolvedValue(
      toolCallResponse([
        {
          name: "generate_deck",
          args: { prompt: "Create a deck about coffee" },
        },
      ]),
    );
    const generated: Deck = {
      id: "deck-2",
      title: "Coffee",
      slides: [
        { id: "x", type: "title", title: "Coffee", body: [], speakerNotes: "" },
      ],
    };
    mockGenerateDeckFromPrompt.mockResolvedValue(generated);

    const response = await POST(
      makeRequest({ message: "Create a deck about coffee", deck }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(mockGenerateDeckFromPrompt).toHaveBeenCalledWith(
      "Create a deck about coffee",
    );
    expect(body.generatedDeck).toEqual(generated);
    expect(body.toolCalls).toEqual([]);
    expect(body.reply).toContain("Coffee");
  });

  it("this is the reported bug's regression guard: a targeted edit request must not trigger generate_deck", async () => {
    // We can't unit-test the model's judgment, but we can guard the
    // mechanical contract: when the model correctly returns delete_slide
    // (as verified live), the route must forward it as a normal tool
    // call, not treat it as a generation request.
    mockCreate.mockResolvedValue(
      toolCallResponse([{ name: "delete_slide", args: { id: "b" } }]),
    );

    const response = await POST(
      makeRequest({ message: "delete slide 2", deck }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(mockGenerateDeckFromPrompt).not.toHaveBeenCalled();
    expect(body.generatedDeck).toBeUndefined();
    expect(body.toolCalls).toEqual([
      { tool: "delete_slide", args: { id: "b" } },
    ]);
  });

  it("drops an invalid tool call but keeps valid ones", async () => {
    mockCreate.mockResolvedValue(
      toolCallResponse([
        { name: "delete_slide", args: { id: "b" } },
        { name: "delete_slide", args: {} }, // missing required id
      ]),
    );

    const response = await POST(
      makeRequest({ message: "Delete slide 2", deck }),
    );
    const body = await response.json();
    expect(body.toolCalls).toHaveLength(1);
    expect(body.toolCalls[0].args.id).toBe("b");
  });

  it("falls back to a synthesized reply when the model returns no text", async () => {
    mockCreate.mockResolvedValue(
      toolCallResponse([{ name: "delete_slide", args: { id: "b" } }], null),
    );
    const response = await POST(
      makeRequest({ message: "Delete slide 2", deck }),
    );
    const body = await response.json();
    expect(body.reply).toContain("deleted a slide");
  });

  it("uses the model's own text reply when present", async () => {
    mockCreate.mockResolvedValue(
      toolCallResponse([], "Could you clarify which slide you mean?"),
    );
    const response = await POST(
      makeRequest({ message: "make it better", deck }),
    );
    const body = await response.json();
    expect(body.reply).toBe("Could you clarify which slide you mean?");
    expect(body.toolCalls).toHaveLength(0);
  });

  it("rejects an empty message with 400 and never calls OpenAI", async () => {
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

  it("returns 502 when the OpenAI call fails", async () => {
    mockCreate.mockRejectedValue(new Error("OpenAI is down"));
    const response = await POST(
      makeRequest({ message: "Delete slide 2", deck }),
    );
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe("OpenAI is down");
  });
});
