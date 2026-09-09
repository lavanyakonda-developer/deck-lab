"use client";

import { useState } from "react";
import { downloadDeckAsPdf } from "@/lib/export/pdf";
import { downloadDeckAsPptx } from "@/lib/export/pptx";
import { useDeckStore } from "@/store/deckStore";

export function ExportActions() {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const slideCount = useDeckStore((state) => state.deck.slides.length);

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await downloadDeckAsPdf(useDeckStore.getState().deck);
    } catch (error) {
      console.error("[export] failed to generate PDF", error);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadPptx = async () => {
    setIsExportingPptx(true);
    try {
      await downloadDeckAsPptx(useDeckStore.getState().deck);
    } catch (error) {
      console.error("[export] failed to generate PPTX", error);
    } finally {
      setIsExportingPptx(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => void handleDownloadPdf()}
        disabled={isExportingPdf || slideCount === 0}
        className="text-sm text-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        {"Download PDF"}
      </button>
      <button
        type="button"
        onClick={() => void handleDownloadPptx()}
        disabled={isExportingPptx || slideCount === 0}
        className="text-sm text-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        {"Download PPTX"}
      </button>
    </div>
  );
}
