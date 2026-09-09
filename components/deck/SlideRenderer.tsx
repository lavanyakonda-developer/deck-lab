import type { Slide } from "@/lib/schema/slide";
import { TitleSlide } from "./slides/TitleSlide";
import { ContentSlide } from "./slides/ContentSlide";
import { TwoColumnSlide } from "./slides/TwoColumnSlide";
import { ComparisonSlide } from "./slides/ComparisonSlide";
import { TableSlide } from "./slides/TableSlide";

export function SlideRenderer({ slide }: { slide: Slide }) {
  switch (slide.type) {
    case "title":
      return <TitleSlide slide={slide} />;
    case "content":
      return <ContentSlide slide={slide} />;
    case "two-column":
      return <TwoColumnSlide slide={slide} />;
    case "comparison":
      return <ComparisonSlide slide={slide} />;
    case "table":
      return <TableSlide slide={slide} />;
  }
}
