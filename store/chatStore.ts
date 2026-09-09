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
  addMessage: (role: ChatMessage["role"], content: string) => void;
  setGenerating: (value: boolean) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      isGenerating: false,

      addMessage: (role, content) =>
        set((state) => ({
          messages: [...state.messages, { id: createId("msg"), role, content }],
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
