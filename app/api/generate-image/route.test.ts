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
        model: "gpt-image-2",
        prompt: "A modern office",
        output_format: "jpeg",
      }),
    );
  });

  it("uses OPENAI_IMAGE_MODEL when set", async () => {
    vi.stubEnv("OPENAI_IMAGE_MODEL", "gpt-image-1-mini");
    mockGenerate.mockResolvedValue({ data: [{ b64_json: "abc123" }] });
    await POST(makeRequest({ prompt: "A modern office" }));
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-image-1-mini" }),
    );
    vi.unstubAllEnvs();
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

  // A failed generation must degrade to a clean error response, and
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
