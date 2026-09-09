import type { SlideThemeTokens } from "@/lib/themes";
import type { Slide } from "@/lib/schema/slide";
import { TitleSlide } from "./slides/TitleSlide";
import { ContentSlide } from "./slides/ContentSlide";
import { TwoColumnSlide } from "./slides/TwoColumnSlide";
import { ComparisonSlide } from "./slides/ComparisonSlide";
import { TableSlide } from "./slides/TableSlide";

export function SlideRenderer({
  slide,
  theme,
}: {
  slide: Slide;
  theme: SlideThemeTokens;
}) {
  switch (slide.type) {
    case "title":
      return <TitleSlide slide={slide} theme={theme} />;
    case "content":
      return <ContentSlide slide={slide} theme={theme} />;
    case "two-column":
      return <TwoColumnSlide slide={slide} theme={theme} />;
    case "comparison":
      return <ComparisonSlide slide={slide} theme={theme} />;
    case "table":
      return <TableSlide slide={slide} theme={theme} />;
  }
}
