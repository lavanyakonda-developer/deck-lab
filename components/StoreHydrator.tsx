"use client";

import { useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { useDeckStore } from "@/store/deckStore";

// Both stores use skipHydration so SSR/first paint always match their in-code defaults; rehydrate here once mounted.
export function StoreHydrator() {
  useEffect(() => {
    void useDeckStore.persist.rehydrate();
    void useChatStore.persist.rehydrate();
  }, []);

  return null;
}
