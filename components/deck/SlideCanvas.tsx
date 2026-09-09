export function SlideCanvas() {
  return (
    <div className="flex flex-1 items-center justify-center overflow-auto bg-zinc-100 p-6 dark:bg-zinc-900">
      <div className="flex aspect-video w-full max-w-3xl items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
        <p className="text-sm text-zinc-400 dark:text-zinc-600">
          No slides yet. Generate a deck or add a blank slide to get started.
        </p>
      </div>
    </div>
  );
}
