// Wraps localStorage for zustand's persist middleware so a burst of set()
// calls (e.g. one per streamed SSE chunk in ChatPanel.tsx) coalesces into a
// single write instead of a synchronous JSON.stringify + setItem per call.
// getItem/removeItem stay synchronous passthroughs - only writes are
// debounced, and pendingValue always holds the latest value so a delayed
// write is never stale.
export function createDebouncedStorage(delayMs = 150) {
  let pendingValue: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    getItem: (key: string) => localStorage.getItem(key),
    setItem: (key: string, value: string) => {
      pendingValue = value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        localStorage.setItem(key, pendingValue!);
        timer = null;
      }, delayMs);
    },
    removeItem: (key: string) => localStorage.removeItem(key),
  };
}
