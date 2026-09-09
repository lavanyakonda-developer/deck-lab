import type { Slide } from "@/lib/schema/slide";
import { ContentBlockRenderer } from "./ContentBlockRenderer";

export function TableSlide({ slide }: { slide: Slide }) {
  const tableBlock = slide.body.find((block) => block.type === "table");

  return (
    <div className="flex h-full flex-col gap-6 px-12 py-10">
      <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {slide.title}
      </h2>
      <div className="flex-1 overflow-auto">
        {tableBlock ? (
          <ContentBlockRenderer block={tableBlock} />
        ) : (
          <p className="text-sm text-zinc-400 dark:text-zinc-600">
            No table content yet.
          </p>
        )}
      </div>
    </div>
  );
}
