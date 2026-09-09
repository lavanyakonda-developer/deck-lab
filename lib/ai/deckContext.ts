import type { ContentBlock, Deck } from "@/lib/schema/slide";

const MAX_PARAGRAPH_CHARS = 120;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function summarizeBlock(block: ContentBlock): string {
  switch (block.type) {
    case "bullets":
      return `bullets: ${block.items.join(" | ")}`;
    case "paragraph":
      return `paragraph: ${truncate(block.text, MAX_PARAGRAPH_CHARS)}`;
    case "table":
      return `table: headers [${block.headers.join(", ")}], ${block.rows.length} row(s)`;
  }
}

// Compact, token-efficient summary of the current deck for the chat
// system prompt - includes every slide's real id (required so the model
// can reference exact slides in update_slide/delete_slide/change_layout
// calls) plus enough content to make good editing decisions, without
// shipping the full deck JSON (speaker notes, etc.) into every request.
export function serializeDeckContext(deck: Deck): string {
  const lines = deck.slides.map((slide, index) => {
    const parts = [
      `${index + 1}. id="${slide.id}" type=${slide.type} title="${slide.title}"`,
    ];
    if (slide.subtitle) parts.push(`subtitle="${slide.subtitle}"`);
    if (slide.layout) parts.push(`layout=${JSON.stringify(slide.layout)}`);
    const blockSummaries = slide.body.map(summarizeBlock);
    if (blockSummaries.length > 0) {
      parts.push(`body: ${blockSummaries.join("; ")}`);
    }
    return parts.join(" ");
  });

  return `Deck "${deck.title}" (id="${deck.id}") — ${deck.slides.length} slide(s):\n${lines.join("\n")}`;
}
