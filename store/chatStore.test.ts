import { beforeEach, describe, expect, it } from "vitest";
import { useChatStore } from "./chatStore";

beforeEach(() => {
  localStorage.clear();
  useChatStore.setState({ messages: [], isGenerating: false });
});

describe("chatStore", () => {
  it("addMessage appends a message with a generated id", () => {
    useChatStore.getState().addMessage("user", "Hello");
    const { messages } = useChatStore.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ role: "user", content: "Hello" });
    expect(messages[0].id).toBeTruthy();
  });

  it("persists messages to localStorage but never isGenerating", () => {
    useChatStore.getState().addMessage("user", "Hello");
    useChatStore.getState().setGenerating(true);

    const raw = localStorage.getItem("deck-lab:chat");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.messages).toHaveLength(1);
    expect(parsed.state.isGenerating).toBeUndefined();
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
