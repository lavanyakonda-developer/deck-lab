import type { Slide } from "@/lib/schema/slide";
import { materializeSlide } from "@/lib/slides/layoutEngine";

export function createBlankSlide(): Slide {
  return materializeSlide({
    type: "content",
    title: "",
    body: [{ type: "bullets", items: ["New bullet point"] }],
  });
}
