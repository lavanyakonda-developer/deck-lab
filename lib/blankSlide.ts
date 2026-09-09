import type { Slide } from "@/lib/schema/slide";

export function createBlankSlide(): Omit<Slide, "id"> {
  return {
    type: "content",
    title: "",
    body: [{ type: "bullets", items: ["New bullet point"] }],
    speakerNotes: "",
  };
}
