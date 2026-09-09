"use client";

import { useState } from "react";
import { downloadDeckAsPptx } from "@/lib/export/pptx";
import { useDeckStore } from "@/store/deckStore";

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const slideCount = useDeckStore((state) => state.deck.slides.length);

  const handleClick = async () => {
    setIsExporting(true);
    try {
      await downloadDeckAsPptx(useDeckStore.getState().deck);
    } catch (error) {
      console.error("[export] failed to generate PPTX", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isExporting || slideCount === 0}
      className="text-sm text-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      {isExporting ? "Exporting…" : "Download PPTX"}
    </button>
  );
}
