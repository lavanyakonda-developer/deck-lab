"use client";

import { useState } from "react";
import { applyToolCall } from "@/lib/ai/applyToolCalls";
import { parseSSEStream } from "@/lib/ai/sseClient";
import type { ValidatedToolCall } from "@/lib/ai/tools";
import { createId } from "@/lib/id";
import type { Deck, Slide } from "@/lib/schema/slide";
import { useChatStore } from "@/store/chatStore";
import { useDeckStore } from "@/store/deckStore";

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
    // The user's message was already pushed onto chatStore by submitPrompt,
    // so it's the last entry here - everything before it is prior context.
    const currentMessages = useChatStore.getState().messages;
    const history = currentMessages
      .slice(0, -1)
      .map(({ role, content }) => ({ role, content }));

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, deck, history }),
    });

    if (!response.ok) {
      // Request-validation failures (bad JSON, empty message, invalid
      // deck) return a plain 400 JSON body, not a stream.
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to process message");
    }

    let assistantMessageId: string | null = null;
    let deckCleared = false;

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
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Chat
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Describe a presentation or ask for changes.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="mx-auto mt-8 max-w-[220px] text-center text-sm text-zinc-400 dark:text-zinc-600">
            Describe a presentation to generate your first draft — e.g.
            &ldquo;Create a 5-slide deck on our Q3 product roadmap&rdquo;.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
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
          <div className="self-start rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            Thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitPrompt();
        }}
        className="border-t border-zinc-200 p-3 dark:border-zinc-800"
      >
        <div className="flex items-end gap-2">
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
            placeholder="Ask the AI to generate or edit slides…"
            className="flex-1 resize-none rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={isGenerating || !input.trim()}
            className="h-9 shrink-0 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  );
}
