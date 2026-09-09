import type { Slide } from "@/lib/schema/slide";

export function TitleSlide({ slide }: { slide: Slide }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-12 text-center">
      <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
        {slide.title}
      </h1>
      {slide.subtitle && (
        <p className="max-w-2xl text-lg text-zinc-500 dark:text-zinc-400">
          {slide.subtitle}
        </p>
      )}
    </div>
  );
}
