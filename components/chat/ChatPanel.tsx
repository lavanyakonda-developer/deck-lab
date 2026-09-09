"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { applyToolCall } from "@/lib/ai/applyToolCalls";
import {
  findPendingImageAlts,
  generateImageForSlide,
} from "@/lib/ai/generateImage";
import { parseSSEStream } from "@/lib/ai/sseClient";
import type { ValidatedToolCall } from "@/lib/ai/tools";
import { createId } from "@/lib/id";
import type { Deck, Slide } from "@/lib/schema/slide";
import { useChatStore } from "@/store/chatStore";
import { useDeckStore } from "@/store/deckStore";

const imageActions = {
  getSlide: (id: string) =>
    useDeckStore.getState().deck.slides.find((slide) => slide.id === id),
  updateSlide: useDeckStore.getState().updateSlide,
};

// Scans the whole current deck for image blocks the model requested but
// hasn't generated yet, and kicks off generation for any not already
// triggered - fire-and-forget, so it never blocks reading the rest of the
// stream. `triggered` de-dupes across the many events in one response.
function triggerPendingImageGeneration(triggered: Set<string>) {
  for (const slide of useDeckStore.getState().deck.slides) {
    for (const alt of findPendingImageAlts(slide)) {
      const key = `${slide.id}:${alt}`;
      if (triggered.has(key)) continue;
      triggered.add(key);
      void generateImageForSlide(imageActions, slide.id, alt);
    }
  }
}

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [showThinking, setShowThinking] = useState(false);
  const messages = useChatStore((state) => state.messages);
  const isGenerating = useChatStore((state) => state.isGenerating);
  const addMessage = useChatStore((state) => state.addMessage);
  const appendToMessage = useChatStore((state) => state.appendToMessage);
  const setMessageContent = useChatStore((state) => state.setMessageContent);
  const setGenerating = useChatStore((state) => state.setGenerating);

  const sendMessage = async (message: string) => {
    const deck = useDeckStore.getState().deck;
    const selectedSlideId = useDeckStore.getState().selectedSlideId;
    // The user's message was already pushed onto chatStore by submitPrompt,
    // so it's the last entry here - everything before it is prior context.
    const currentMessages = useChatStore.getState().messages;
    const history = currentMessages
      .slice(0, -1)
      .map(({ role, content }) => ({ role, content }));

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, deck, history, selectedSlideId }),
    });

    if (!response.ok) {
      // Request-validation failures (bad JSON, empty message, invalid
      // deck) return a plain 400 JSON body, not a stream.
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to process message");
    }

    let assistantMessageId: string | null = null;
    let deckCleared = false;
    const triggeredImages = new Set<string>();

    for await (const evt of parseSSEStream(response)) {
      setShowThinking(false);

      switch (evt.event) {
        case "text-delta": {
          const { text } = evt.data as { text: string };
          if (assistantMessageId === null) {
            assistantMessageId = addMessage("assistant", "");
          }
          appendToMessage(assistantMessageId, text);
          break;
        }

        case "tool-call": {
          applyToolCall(useDeckStore.getState(), evt.data as ValidatedToolCall);
          break;
        }

        case "slide": {
          if (!deckCleared) {
            useDeckStore.getState().loadDeck({
              id: createId("deck"),
              title: "Generating…",
              slides: [],
            });
            deckCleared = true;
          }
          useDeckStore.getState().addSlide(evt.data as Slide);
          break;
        }

        case "done": {
          const { reply, generatedDeck } = evt.data as {
            reply: string;
            generatedDeck?: Deck;
          };
          if (generatedDeck) {
            // Reconciles the final title and slide set - reuses the same
            // slide ids already streamed via "slide" events above.
            useDeckStore.getState().loadDeck(generatedDeck);
          }
          if (assistantMessageId === null) {
            addMessage("assistant", reply);
          } else {
            setMessageContent(assistantMessageId, reply);
          }
          break;
        }

        case "error": {
          const { error } = evt.data as { error: string };
          throw new Error(error);
        }
      }

      triggerPendingImageGeneration(triggeredImages);
    }
  };

  const submitPrompt = async () => {
    const prompt = input.trim();
    if (!prompt || isGenerating) return;

    addMessage("user", prompt);
    setInput("");
    setGenerating(true);
    setShowThinking(true);

    try {
      await sendMessage(prompt);
    } catch (error) {
      addMessage(
        "assistant",
        error instanceof Error
          ? `Something went wrong: ${error.message}`
          : "Something went wrong.",
      );
    } finally {
      setGenerating(false);
      setShowThinking(false);
    }
  };

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-r border-zinc-100 bg-white dark:border-zinc-900 dark:bg-zinc-950">
      <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-900">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Your AI-Powered Presentation Builder
        </h2>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Describe a presentation or ask for changes.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 ? (
          <p className="mx-auto mt-8 max-w-[240px] justify-center text-center text-sm leading-relaxed text-zinc-400 dark:text-zinc-600">
            Try &ldquo;Create a 5-slide deck on javascript&rdquo; to get
            started.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                message.role === "user"
                  ? "self-end bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "self-start bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              {message.content}
            </div>
          ))
        )}
        {showThinking && (
          <div className="self-start rounded-xl bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            Thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitPrompt();
        }}
        className="border-t border-zinc-100 p-4 dark:border-zinc-900"
      >
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submitPrompt();
              }
            }}
            disabled={isGenerating}
            rows={2}
            placeholder="Ask anything…"
            className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 py-2.5 pr-14 pl-3.5 text-sm leading-relaxed text-zinc-900 placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={isGenerating || !input.trim()}
            aria-label="Send"
            title="Send"
            className="absolute right-2 bottom-6 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900"
          >
            <ArrowUp size={18} strokeWidth={2} />
          </button>
        </div>
      </form>
    </aside>
  );
}
