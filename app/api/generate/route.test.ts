import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Slide } from "@/lib/schema/slide";

const mockGenerateDeckStreamed = vi.fn();

vi.mock("@/lib/ai/generateDeckStream", () => ({
  generateDeckStreamed: (prompt: string, onSlide: (slide: Slide) => void) =>
    mockGenerateDeckStreamed(prompt, onSlide),
}));

import { POST } from "./route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/generate", {
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

const slide1: Slide = {
  id: "s1",
  type: "title",
  title: "Q3 Roadmap",
  body: [],
};
const slide2: Slide = {
  id: "s2",
  type: "content",
  title: "Objectives",
  body: [],
};

describe("POST /api/generate", () => {
  beforeEach(() => {
    mockGenerateDeckStreamed.mockReset();
  });

  it("streams a slide event per slide, then a done event with the full deck", async () => {
    mockGenerateDeckStreamed.mockImplementation(async (_prompt, onSlide) => {
      onSlide(slide1);
      onSlide(slide2);
      return { id: "deck-1", title: "Q3 Roadmap", slides: [slide1, slide2] };
    });

    const response = await POST(
      makeRequest({ prompt: "Create a 5-slide deck on our Q3 roadmap" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");

    const events = await readSSE(response);
    expect(events).toEqual([
      { event: "slide", data: slide1 },
      { event: "slide", data: slide2 },
      {
        event: "done",
        data: {
          deck: { id: "deck-1", title: "Q3 Roadmap", slides: [slide1, slide2] },
        },
      },
    ]);
  });

  it("trims the prompt before passing it along", async () => {
    mockGenerateDeckStreamed.mockImplementation(async () => ({
      id: "deck-1",
      title: "X",
      slides: [],
    }));
    await POST(makeRequest({ prompt: "  Create a deck  " }));
    expect(mockGenerateDeckStreamed).toHaveBeenCalledWith(
      "Create a deck",
      expect.any(Function),
    );
  });

  it("rejects an empty prompt with 400 and never starts streaming", async () => {
    const response = await POST(makeRequest({ prompt: "   " }));
    expect(response.status).toBe(400);
    expect(mockGenerateDeckStreamed).not.toHaveBeenCalled();
  });

  it("rejects a missing prompt field with 400", async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
    expect(mockGenerateDeckStreamed).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON with 400", async () => {
    const response = await POST(makeRequest("not json"));
    expect(response.status).toBe(400);
    expect(mockGenerateDeckStreamed).not.toHaveBeenCalled();
  });

  it("emits an error SSE event (HTTP 200) when generation fails", async () => {
    mockGenerateDeckStreamed.mockRejectedValue(new Error("OpenAI is down"));
    const response = await POST(makeRequest({ prompt: "Create a deck" }));
    expect(response.status).toBe(200);
    const events = await readSSE(response);
    expect(events).toEqual([
      { event: "error", data: { error: "OpenAI is down" } },
    ]);
  });

  it("emits already-streamed slides even if generation fails partway through", async () => {
    mockGenerateDeckStreamed.mockImplementation(async (_prompt, onSlide) => {
      onSlide(slide1);
      throw new Error("Stream interrupted");
    });
    const response = await POST(makeRequest({ prompt: "Create a deck" }));
    const events = await readSSE(response);
    expect(events).toEqual([
      { event: "slide", data: slide1 },
      { event: "error", data: { error: "Stream interrupted" } },
    ]);
  });
});
