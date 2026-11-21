// The deck store persists to localStorage, which Node doesn't have. This
// in-memory stand-in lets the evals run the real store unchanged. Imported
// for its side effect, before the store is used.
if (typeof globalThis.localStorage === "undefined") {
  const items = new Map<string, string>();
  globalThis.localStorage = {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

export {};
