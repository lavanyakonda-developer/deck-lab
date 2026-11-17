import type {
  ContentBlock,
  ElementContent,
  Slide,
  SlideElement,
} from "@/lib/schema/slide";

type ImageContent = Extract<ContentBlock, { type: "image" }>;

interface DeckImageActions {
  getSlide: (id: string) => Slide | undefined;
  updateElement: (
    slideId: string,
    elementId: string,
    content: ElementContent,
  ) => void;
}

function isPendingImage(
  element: SlideElement,
  alt?: string,
): element is SlideElement & { content: ImageContent } {
  return (
    element.content.type === "image" &&
    element.content.url === null &&
    (alt === undefined || element.content.alt === alt)
  );
}

// Scans one slide for image elements the model requested (via "alt") but
// that haven't been generated yet.
export function findPendingImageAlts(slide: Slide): string[] {
  return slide.elements
    .filter((element) => isPendingImage(element))
    .map((element) => (element.content as ImageContent).alt);
}

// Generates one image and, on success, patches it into the matching
// element. Never throws - a failed/skipped generation just leaves url
// null, which the canvas already renders as a graceful placeholder.
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

// Matches by (slideId, alt, url === null) rather than a fixed element id
// captured up front, since the slide may have been edited (or re-laid out)
// while generation was in flight.
function applyImageUrl(
  actions: DeckImageActions,
  slideId: string,
  alt: string,
  url: string,
): void {
  const slide = actions.getSlide(slideId);
  if (!slide) return; // slide was deleted meanwhile
  const element = slide.elements.find((el) => isPendingImage(el, alt));
  if (!element) return; // image was edited/removed meanwhile
  actions.updateElement(slideId, element.id, { ...element.content, url });
}
