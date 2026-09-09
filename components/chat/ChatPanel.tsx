export function ChatPanel() {
  return (
    <aside className="flex h-full w-full flex-col border-b border-zinc-200 bg-white md:w-[380px] md:shrink-0 md:border-b-0 md:border-r dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Chat
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Describe a presentation or ask for changes.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <p className="max-w-[220px] text-center text-sm text-zinc-400 dark:text-zinc-600">
          No messages yet. AI generation lands in a later phase.
        </p>
      </div>

      <form className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex items-end gap-2">
          <textarea
            disabled
            rows={2}
            placeholder="Ask the AI to generate or edit slides…"
            className="flex-1 resize-none rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 placeholder:text-zinc-400 disabled:cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500"
          />
          <button
            type="submit"
            disabled
            className="h-9 shrink-0 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  );
}
