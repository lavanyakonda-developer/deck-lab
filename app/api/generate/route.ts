import { NextResponse } from "next/server";
import { generateDeckStreamed } from "@/lib/ai/generateDeckStream";
import { formatSSE } from "@/lib/ai/sse";

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

  const trimmedPrompt = prompt.trim();
  const encoder = new TextEncoder();

  // Once this stream starts, the HTTP status is fixed at 200 - a failure
  // partway through (or even immediately) can only be signaled via an
  // "error" SSE event, not a different status code. The client must
  // check event type, not response.ok, to detect failure.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const deck = await generateDeckStreamed(trimmedPrompt, (slide) => {
          controller.enqueue(encoder.encode(formatSSE("slide", slide)));
        });
        controller.enqueue(encoder.encode(formatSSE("done", { deck })));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to generate deck";
        controller.enqueue(
          encoder.encode(formatSSE("error", { error: message })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
