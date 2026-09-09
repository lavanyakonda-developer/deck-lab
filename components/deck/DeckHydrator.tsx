"use client";

import { useEffect } from "react";
import { useDeckStore } from "@/store/deckStore";

// Store uses skipHydration so SSR/first paint always matches the seed deck; rehydrate here once mounted.
export function DeckHydrator() {
  useEffect(() => {
    void useDeckStore.persist.rehydrate();
  }, []);

  return null;
}
