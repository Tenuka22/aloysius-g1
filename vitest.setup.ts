import "@testing-library/jest-dom/vitest";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function createStorageStub(): Storage {
  let store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store = new Map();
    },
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key))! : null;
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key) {
      store.delete(String(key));
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
  } as Storage;
}

if (typeof window !== "undefined") {
  const win = window as unknown as Record<string, unknown>;
  const gbl = globalThis as unknown as Record<string, unknown>;
  if (!win.ResizeObserver) win.ResizeObserver = ResizeObserverStub;
  if (!gbl.ResizeObserver) gbl.ResizeObserver = ResizeObserverStub;
  if (!win.PointerEvent) win.PointerEvent = win.MouseEvent;
  if (!win.localStorage) {
    const storage = createStorageStub();
    win.localStorage = storage;
    gbl.localStorage = storage;
  }
  if (!win.matchMedia) {
    win.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });
  }
  const elementProto = Element.prototype as unknown as Record<string, unknown>;
  if (!elementProto.scrollIntoView) elementProto.scrollIntoView = () => undefined;
  if (!elementProto.hasPointerCapture) elementProto.hasPointerCapture = () => false;
}