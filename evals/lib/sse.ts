import { parseSSEStream } from "@/lib/ai/sseClient";

export interface TimedEvent {
  event: string;
  data: unknown;
  // Milliseconds since the request was sent.
  t: number;
}

export interface SSEResult {
  status: number;
  events: TimedEvent[];
  // Time until the stream closed (or the error body was read).
  totalMs: number;
  // Set when the server rejected the request before streaming (e.g. 400).
  httpError?: string;
}

// POSTs a JSON body to one of the app's streaming routes and collects every
// SSE event with its arrival time. Reuses the app's own SSE parser, so the
// eval reads the stream exactly the way the browser does.
export async function postSSE(url: string, body: unknown): Promise<SSEResult> {
  const start = performance.now();
  const elapsed = () => Math.round(performance.now() - start);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      status: response.status,
      events: [],
      totalMs: elapsed(),
      httpError: text,
    };
  }

  const events: TimedEvent[] = [];
  for await (const { event, data } of parseSSEStream(response)) {
    events.push({ event, data, t: elapsed() });
  }
  return { status: response.status, events, totalMs: elapsed() };
}

export function eventsOfType<T>(events: TimedEvent[], type: string): T[] {
  return events.filter((e) => e.event === type).map((e) => e.data as T);
}

export function firstEventTime(
  events: TimedEvent[],
  type: string,
): number | undefined {
  return events.find((e) => e.event === type)?.t;
}
