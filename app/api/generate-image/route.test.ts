import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerate = vi.fn();

vi.mock("@/lib/ai/openaiClient", () => ({
  getOpenAIClient: () => ({
    images: { generate: mockGenerate },
  }),
}));

import { POST } from "./route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/generate-image", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/generate-image", () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  it("returns a data: URI built from the base64 image on success", async () => {
    mockGenerate.mockResolvedValue({ data: [{ b64_json: "abc123" }] });

    const response = await POST(makeRequest({ prompt: "A modern office" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.url).toBe("data:image/jpeg;base64,abc123");
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-image-1",
        prompt: "A modern office",
        output_format: "jpeg",
      }),
    );
  });

  it("trims the prompt before passing it along", async () => {
    mockGenerate.mockResolvedValue({ data: [{ b64_json: "abc123" }] });
    await POST(makeRequest({ prompt: "  A modern office  " }));
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "A modern office" }),
    );
  });

  it("rejects an empty prompt with 400 and never calls OpenAI", async () => {
    const response = await POST(makeRequest({ prompt: "   " }));
    expect(response.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON with 400", async () => {
    const response = await POST(makeRequest("not json"));
    expect(response.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  // The explicit "mocked failure -> fallback path, not a crash" case from
  // the phase spec: the route must degrade to a clean error response, and
  // the caller (lib/ai/generateImage.ts) treats that as "leave url null",
  // never throwing all the way up to crash the UI.
  it("returns 502 with the error message when OpenAI fails, rather than throwing", async () => {
    mockGenerate.mockRejectedValue(new Error("Image generation is down"));

    const response = await POST(makeRequest({ prompt: "A modern office" }));

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe("Image generation is down");
  });

  it("returns 502 when OpenAI resolves with no image data", async () => {
    mockGenerate.mockResolvedValue({ data: [] });
    const response = await POST(makeRequest({ prompt: "A modern office" }));
    expect(response.status).toBe(502);
  });
});
