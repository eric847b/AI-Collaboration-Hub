// NOTE: jest-dom/vitest import intentionally omitted — it takes ~28s to load in a
// node environment. These are pure-logic unit tests (store + utils) that only need
// core vitest matchers. Add it back per-file (or in a DOM-env config) for component tests.

// Minimal localStorage polyfill so the zustand persist middleware works in node env.
if (typeof globalThis !== "undefined" && typeof localStorage === "undefined") {
  const store = new Map<string, string>();
  const localStorageMock: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    writable: true,
    value: localStorageMock,
  });
}
