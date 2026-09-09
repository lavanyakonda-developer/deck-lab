import type { Slide } from "@/lib/schema/slide";
import { ContentBlockRenderer } from "./ContentBlockRenderer";

export function ContentSlide({ slide }: { slide: Slide }) {
  return (
    <div className="flex h-full flex-col gap-6 px-12 py-10">
      <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {slide.title}
      </h2>
      <div className="flex flex-1 flex-col justify-center gap-4">
        {slide.body.map((block, i) => (
          <ContentBlockRenderer key={i} block={block} />
        ))}
      </div>
    </div>
  );
}
