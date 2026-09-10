import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "./chatStore";

beforeEach(() => {
  localStorage.clear();
  useChatStore.setState({ messages: [], isGenerating: false });
});

describe("chatStore", () => {
  it("addMessage appends a message with a generated id and returns it", () => {
    const id = useChatStore.getState().addMessage("user", "Hello");
    const { messages } = useChatStore.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ role: "user", content: "Hello" });
    expect(messages[0].id).toBe(id);
  });

  it("appendToMessage appends text to the targeted message only", () => {
    const id = useChatStore.getState().addMessage("assistant", "Hel");
    useChatStore.getState().addMessage("user", "unrelated");
    useChatStore.getState().appendToMessage(id, "lo");
    useChatStore.getState().appendToMessage(id, " world");

    const { messages } = useChatStore.getState();
    expect(messages.find((m) => m.id === id)?.content).toBe("Hello world");
    expect(messages.find((m) => m.role === "user")?.content).toBe("unrelated");
  });

  it("setMessageContent replaces a message's content outright", () => {
    const id = useChatStore.getState().addMessage("assistant", "draft");
    useChatStore.getState().setMessageContent(id, "final");
    expect(
      useChatStore.getState().messages.find((m) => m.id === id)?.content,
    ).toBe("final");
  });

  it("persists messages to localStorage but never isGenerating", () => {
    vi.useFakeTimers();
    try {
      useChatStore.getState().addMessage("user", "Hello");
      useChatStore.getState().setGenerating(true);
      // Writes are debounced (see store/debouncedStorage.ts) - advance past
      // the delay so the pending write actually lands.
      vi.runAllTimers();

      const raw = localStorage.getItem("deck-lab:chat");
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw as string);
      expect(parsed.state.messages).toHaveLength(1);
      expect(parsed.state.isGenerating).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rehydrates saved messages on a fresh load, isGenerating stays false", async () => {
    localStorage.setItem(
      "deck-lab:chat",
      JSON.stringify({
        state: {
          messages: [{ id: "m1", role: "assistant", content: "Saved reply" }],
        },
        version: 0,
      }),
    );

    await useChatStore.persist.rehydrate();

    const state = useChatStore.getState();
    expect(state.messages).toEqual([
      { id: "m1", role: "assistant", content: "Saved reply" },
    ]);
    expect(state.isGenerating).toBe(false);
  });
});
