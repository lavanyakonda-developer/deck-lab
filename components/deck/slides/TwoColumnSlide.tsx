import type { Slide } from "@/lib/schema/slide";
import { ContentBlockRenderer } from "./ContentBlockRenderer";

export function TwoColumnSlide({ slide }: { slide: Slide }) {
  const left = slide.body.filter((block) => (block.column ?? 0) === 0);
  const right = slide.body.filter((block) => (block.column ?? 0) === 1);
  const [leftTitle, rightTitle] = slide.layout?.columnTitles ?? [];

  return (
    <div className="flex h-full flex-col gap-6 px-12 py-10">
      <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {slide.title}
      </h2>
      <div className="grid flex-1 grid-cols-2 gap-8">
        <div className="flex flex-col gap-3">
          {leftTitle && (
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              {leftTitle}
            </h3>
          )}
          {left.map((block, i) => (
            <ContentBlockRenderer key={i} block={block} />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {rightTitle && (
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              {rightTitle}
            </h3>
          )}
          {right.map((block, i) => (
            <ContentBlockRenderer key={i} block={block} />
          ))}
        </div>
      </div>
    </div>
  );
}
