import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/ai/openaiClient";

// OpenAI retires image models over time (gpt-image-1 was removed from this
// account's model list, failing every request with "model does not exist"),
// so the model is env-configurable rather than hardcoded. Read per request,
// not at module load, so it can't break `npm run build`.
const DEFAULT_IMAGE_MODEL = "gpt-image-2";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = (body as { prompt?: unknown } | null)?.prompt;
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json(
      { error: "A non-empty 'prompt' string is required" },
      { status: 400 },
    );
  }

  try {
    const client = getOpenAIClient();
    // GPT image models always return base64 (no url/response_format option -
    // and confirmed live that this account doesn't have dall-e-3 access
    // anyway), which conveniently sidesteps OpenAI's ~60-minute URL expiry:
    // a deck persists far longer than that in localStorage, so a url would
    // go stale. jpeg + compression keeps the base64 payload reasonable -
    // lossless PNG at 1024x1024 ran ~1.6MB, which adds up fast against
    // localStorage's ~5-10MB quota once a deck has a few images.
    const result = await client.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
      prompt: prompt.trim(),
      size: "1024x1024",
      quality: "medium",
      output_format: "jpeg",
      output_compression: 70,
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("OpenAI returned no image data");
    }

    return NextResponse.json({ url: `data:image/jpeg;base64,${b64}` });
  } catch (error) {
    console.error("POST /api/generate-image failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate image";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
