import "./memoryStorage";
import { applyToolCall } from "@/lib/ai/applyToolCalls";
import type { ValidatedToolCall } from "@/lib/ai/tools";
import type { Deck } from "@/lib/schema/slide";
import { useDeckStore } from "@/store/deckStore";
import type { TimedEvent } from "./sse";

// Replays a /api/chat response onto a copy of `deck` through the app's real
// deck store - the same actions and the same applyToolCall the chat panel
// uses - and returns the resulting deck. The input deck is never mutated.
//
// The store is a process-wide singleton, so calls must not overlap; the
// eval runners execute cases one at a time.
export function applyChatEvents(deck: Deck, events: TimedEvent[]): Deck {
  const store = useDeckStore.getState();
  store.loadDeck(structuredClone(deck));

  for (const { event, data } of events) {
    if (event === "tool-call") {
      applyToolCall(useDeckStore.getState(), data as ValidatedToolCall);
    } else if (event === "done") {
      // generate_deck replaces the whole deck; the client reconciles to the
      // final deck from the done event the same way.
      const { generatedDeck } = data as { generatedDeck?: Deck };
      if (generatedDeck) useDeckStore.getState().loadDeck(generatedDeck);
    }
  }

  return structuredClone(useDeckStore.getState().deck);
}
