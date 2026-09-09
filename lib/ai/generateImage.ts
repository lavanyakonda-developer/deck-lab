import type { ContentBlock, Slide } from "@/lib/schema/slide";

interface DeckImageActions {
  getSlide: (id: string) => Slide | undefined;
  updateSlide: (id: string, patch: { body: ContentBlock[] }) => void;
}

// Scans one slide for image blocks the model requested (via "alt") but
// that haven't been generated yet.
export function findPendingImageAlts(slide: Slide): string[] {
  return slide.body
    .filter(
      (block): block is Extract<ContentBlock, { type: "image" }> =>
        block.type === "image" && block.url === null,
    )
    .map((block) => block.alt);
}

// Generates one image and, on success, patches it into the matching block.
// Never throws - a failed/skipped generation just leaves url null, which
// EditableContentBlock already renders as a graceful placeholder.
export async function generateImageForSlide(
  actions: DeckImageActions,
  slideId: string,
  alt: string,
): Promise<void> {
  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: alt }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to generate image");
    }
    applyImageUrl(actions, slideId, alt, data.url as string);
  } catch {
    // Intentionally silent - see docstring above.
  }
}

// Matches by (slideId, alt, url === null) rather than a fixed body index,
// since the slide may have been edited elsewhere while generation was in
// flight - this survives unrelated reordering/edits to other blocks on
// the same slide, though not a rename/removal of this exact block.
function applyImageUrl(
  actions: DeckImageActions,
  slideId: string,
  alt: string,
  url: string,
): void {
  const slide = actions.getSlide(slideId);
  if (!slide) return; // slide was deleted meanwhile
  const index = slide.body.findIndex(
    (block) =>
      block.type === "image" && block.alt === alt && block.url === null,
  );
  if (index === -1) return; // block was edited/removed meanwhile
  const body = slide.body.map((block, i) =>
    i === index ? { ...block, url } : block,
  );
  actions.updateSlide(slideId, { body });
}
