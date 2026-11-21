// Caps how much prior conversation gets resent to OpenAI on every request -
// the chat UI itself always keeps the full history, this only bounds the
// outgoing OpenAI request. Keeps token usage/cost from growing unbounded as
// a session goes on, and limits how many repetitive prior turns (e.g. many
// "Done — ..." confirmations) can accumulate in-context, which is believed
// to contribute to the model hallucinating a fake confirmation instead of
// actually calling a tool in long sessions.
export const DEFAULT_MAX_HISTORY_MESSAGES = 10;

// CHAT_MAX_HISTORY_MESSAGES overrides the cap (e.g. for the context-growth
// eval): a positive integer sets the cap, "0" disables it. Anything else
// falls back to the default. Read per request, not at module load, so it
// always reflects the server's current environment.
export function getMaxHistoryMessages(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env.CHAT_MAX_HISTORY_MESSAGES?.trim();
  if (!raw) return DEFAULT_MAX_HISTORY_MESSAGES;
  if (!/^\d+$/.test(raw)) return DEFAULT_MAX_HISTORY_MESSAGES;
  const value = Number(raw);
  return value === 0 ? Infinity : value;
}

// Keeps the most recent `max` messages, dropping the oldest first.
export function trimHistory<T>(history: T[], max: number): T[] {
  return history.length > max ? history.slice(history.length - max) : history;
}
