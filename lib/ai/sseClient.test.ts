import { describe, expect, it } from "vitest";
import { parseSSEStream } from "./sseClient";
import { formatSSE } from "./sse";

function makeResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(body);
}

async function collect(response: Response) {
  const events = [];
  for await (const event of parseSSEStream(response)) {
    events.push(event);
  }
  return events;
}

describe("parseSSEStream", () => {
  it("parses multiple events delivered in one chunk", async () => {
    const raw =
      formatSSE("slide", { id: "s1" }) + formatSSE("done", { reply: "ok" });
    const events = await collect(makeResponse([raw]));
    expect(events).toEqual([
      { event: "slide", data: { id: "s1" } },
      { event: "done", data: { reply: "ok" } },
    ]);
  });

  it("reconstructs an event whose bytes are split across an arbitrary chunk boundary", async () => {
    const raw = formatSSE("tool-call", {
      tool: "delete_slide",
      args: { id: "b" },
    });
    // Split mid-way through the "data:" line, not on any natural boundary.
    const splitPoint = Math.floor(raw.length / 2);
    const events = await collect(
      makeResponse([raw.slice(0, splitPoint), raw.slice(splitPoint)]),
    );
    expect(events).toEqual([
      { event: "tool-call", data: { tool: "delete_slide", args: { id: "b" } } },
    ]);
  });

  it("reconstructs events split character by character", async () => {
    const raw = formatSSE("text-delta", { text: "hi" });
    const chunks = raw.split("");
    const events = await collect(makeResponse(chunks));
    expect(events).toEqual([{ event: "text-delta", data: { text: "hi" } }]);
  });

  it("yields nothing for a response with no body", async () => {
    const response = new Response(null);
    const events = await collect(response);
    expect(events).toEqual([]);
  });

  it("processes multiple sequential events in order across ragged chunk boundaries", async () => {
    const raw =
      formatSSE("slide", { id: "1" }) +
      formatSSE("slide", { id: "2" }) +
      formatSSE("done", { reply: "done" });
    // Chop into fixed-size chunks unrelated to event boundaries.
    const chunks: string[] = [];
    for (let i = 0; i < raw.length; i += 17) {
      chunks.push(raw.slice(i, i + 17));
    }
    const events = await collect(makeResponse(chunks));
    expect(events).toEqual([
      { event: "slide", data: { id: "1" } },
      { event: "slide", data: { id: "2" } },
      { event: "done", data: { reply: "done" } },
    ]);
  });
});
