import type { ContentBlock, Deck } from "@/lib/schema/slide";
import { getSlideContent } from "@/lib/slides/layoutEngine";

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
    case "chart":
      // Never include full data points or base64 image data here - keeps
      // the context compact and avoids the token budget ballooning as a
      // deck accumulates rich content.
      return `chart: ${block.chartType}, ${block.data.length} data point(s)${block.caption ? ` - "${block.caption}"` : ""}`;
    case "image":
      return `image: "${block.alt}"${block.url ? " (generated)" : " (pending/no image)"}`;
  }
}

// Compact, token-efficient summary of the current deck for the chat
// system prompt - includes every slide's real id (required so the model
// can reference exact slides in update_slide/delete_slide/change_layout
// calls) plus enough content to make good editing decisions, without
// shipping the full deck JSON (speaker notes, etc.) into every request.
// selectedSlideId (the slide currently shown in the canvas) is marked
// inline so the model can resolve an unqualified request ("change the
// title to X") to it instead of asking which slide - see
// app/api/chat/route.ts's system prompt for the resolution rule itself.
export function serializeDeckContext(
  deck: Deck,
  selectedSlideId?: string | null,
): string {
  const lines = deck.slides.map((stored, index) => {
    // The model reads and edits semantic content (read from elements by
    // role); element positions aren't useful to its tools and would only
    // bloat the prompt.
    const slide = { id: stored.id, ...getSlideContent(stored) };
    const parts = [
      `${index + 1}. id="${slide.id}" type=${slide.type} title="${slide.title}"`,
    ];
    if (slide.id === selectedSlideId) {
      parts.push("(currently selected/viewed by the user)");
    }
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

const ORDINAL_WORDS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
  "thirteenth",
  "fourteenth",
  "fifteenth",
  "sixteenth",
  "seventeenth",
  "eighteenth",
  "nineteenth",
  "twentieth",
];

// Whether `message` names a slide of `deck` explicitly: by number ("slide
// 3", "slide #3", "3rd slide", "third slide") or by containing a slide's
// exact current title (case-insensitive). When it does, the chat route
// leaves the selection marker out of the deck context, so the model can't
// mistake an explicitly named slide for the confirm-first case. Slides
// named only by description ("the pricing slide") aren't detected here -
// the system prompt's rule covers those.
export function messageNamesSlide(message: string, deck: Deck): boolean {
  const text = message.toLowerCase();
  if (/\bslides?\s*(?:#|no\.?|number)?\s*\d+\b/.test(text)) return true;
  if (/\b\d+(?:st|nd|rd|th)\s+slide\b/.test(text)) return true;
  if (
    new RegExp(`\\b(?:${ORDINAL_WORDS.join("|")}|last)\\s+slide\\b`).test(text)
  ) {
    return true;
  }
  return deck.slides.some((slide) => {
    const title = getSlideContent(slide).title.trim().toLowerCase();
    return title.length > 0 && text.includes(title);
  });
}
