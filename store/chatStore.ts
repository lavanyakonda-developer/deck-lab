import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createId } from "@/lib/id";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatState {
  messages: ChatMessage[];
  isGenerating: boolean;
  addMessage: (role: ChatMessage["role"], content: string) => string;
  appendToMessage: (id: string, delta: string) => void;
  setMessageContent: (id: string, content: string) => void;
  setGenerating: (value: boolean) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      isGenerating: false,

      addMessage: (role, content) => {
        const id = createId("msg");
        set((state) => ({
          messages: [...state.messages, { id, role, content }],
        }));
        return id;
      },

      appendToMessage: (id, delta) =>
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === id
              ? { ...message, content: message.content + delta }
              : message,
          ),
        })),

      setMessageContent: (id, content) =>
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === id ? { ...message, content } : message,
          ),
        })),

      setGenerating: (value) => set({ isGenerating: value }),
    }),
    {
      name: "deck-lab:chat",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // isGenerating is ephemeral request state, never restore it as true.
      partialize: (state) => ({ messages: state.messages }),
    },
  ),
);
