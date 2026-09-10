// Coalesces bursty writes (e.g. streamed SSE chunks) into one localStorage
// write per delay window instead of one per call.
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
