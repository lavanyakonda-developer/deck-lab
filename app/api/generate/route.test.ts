import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Deck } from "@/lib/schema/slide";

vi.mock("@/lib/ai/generateDeck", () => ({
  generateDeckFromPrompt: vi.fn(),
}));

import { generateDeckFromPrompt } from "@/lib/ai/generateDeck";
import { POST } from "./route";

const mockedGenerate = vi.mocked(generateDeckFromPrompt);

const fakeDeck: Deck = {
  id: "deck-1",
  title: "Q3 Roadmap",
  slides: [
    {
      id: "s1",
      type: "title",
      title: "Q3 Roadmap",
      body: [],
      speakerNotes: "",
    },
  ],
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/generate", () => {
  beforeEach(() => {
    mockedGenerate.mockReset();
  });

  it("returns the generated deck for a valid prompt", async () => {
    mockedGenerate.mockResolvedValue(fakeDeck);

    const response = await POST(
      makeRequest({ prompt: "Create a 5-slide deck on our Q3 roadmap" }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.deck.title).toBe("Q3 Roadmap");
    expect(mockedGenerate).toHaveBeenCalledWith(
      "Create a 5-slide deck on our Q3 roadmap",
    );
  });

  it("trims the prompt before passing it along", async () => {
    mockedGenerate.mockResolvedValue(fakeDeck);
    await POST(makeRequest({ prompt: "  Create a deck  " }));
    expect(mockedGenerate).toHaveBeenCalledWith("Create a deck");
  });

  it("rejects an empty prompt with 400 and never calls generateDeckFromPrompt", async () => {
    const response = await POST(makeRequest({ prompt: "   " }));
    expect(response.status).toBe(400);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("rejects a missing prompt field with 400", async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON with 400", async () => {
    const response = await POST(makeRequest("not json"));
    expect(response.status).toBe(400);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("returns 502 with the error message when generation fails", async () => {
    mockedGenerate.mockRejectedValue(new Error("OpenAI is down"));
    const response = await POST(makeRequest({ prompt: "Create a deck" }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe("OpenAI is down");
  });
});
