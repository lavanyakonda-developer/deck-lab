"use client";

import { useState } from "react";
import { FileDown, Presentation } from "lucide-react";
import { getSlideTheme } from "@/lib/themes";
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
      const state = useDeckStore.getState();
      await downloadDeckAsPdf(state.deck, getSlideTheme(state.slideTheme));
    } catch (error) {
      console.error("[export] failed to generate PDF", error);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadPptx = async () => {
    setIsExportingPptx(true);
    try {
      const state = useDeckStore.getState();
      await downloadDeckAsPptx(state.deck, getSlideTheme(state.slideTheme));
    } catch (error) {
      console.error("[export] failed to generate PPTX", error);
    } finally {
      setIsExportingPptx(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => void handleDownloadPdf()}
        disabled={isExportingPdf || slideCount === 0}
        aria-label="Download PDF"
        title="Download PDF"
        className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
      >
        <FileDown size={18} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => void handleDownloadPptx()}
        disabled={isExportingPptx || slideCount === 0}
        aria-label="Download PPTX"
        title="Download PPTX"
        className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
      >
        <Presentation size={18} strokeWidth={1.75} />
      </button>
    </div>
  );
}
