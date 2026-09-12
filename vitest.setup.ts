import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";

// `createIsomorphicFn`'s `.server()` branch runs under vitest (there is no real
// Start/H3 request context in tests), so `@tanstack/react-start/server`'s real
// cookie functions throw ("No StartEvent found in AsyncLocalStorage"). Mock our
// own `@/lib/cookies` wrapper directly (rather than the underlying package) with
// a `document.cookie`-backed implementation - jsdom provides a real `document`,
// so this behaves like an actual browser for every test.
vi.mock("@/lib/cookies", () => {
  const readCookie = (name: string): string | null => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(name)}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  };
  return {
    getAppCookie: readCookie,
    // jsdom's single `document.cookie` jar never holds two same-named cookies at
    // once (unlike a real browser sharing one across a host-only and a
    // shared-domain cookie - see cookies.ts), so the real multi-value case is
    // covered directly against the unmocked module in cookies.test.ts instead.
    getAllAppCookieValues: (name: string): string[] => {
      const value = readCookie(name);
      return value === null ? [] : [value];
    },
    setAppCookie: (name: string, value: string, maxAgeDays = 365): void => {
      document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeDays * 24 * 60 * 60}`;
    },
    removeAppCookie: (name: string): void => {
      document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0`;
    },
  };
});

// Ensure React Testing Library cleanup runs between tests.
afterEach(() => {
  cleanup();
});

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

const gbl = globalThis as unknown as Record<string, unknown>;
if (!gbl.ResizeObserver) gbl.ResizeObserver = ResizeObserverStub;
if (!gbl.localStorage) gbl.localStorage = createStorageStub();
if (!gbl.sessionStorage) gbl.sessionStorage = createStorageStub();
if (!gbl.matchMedia) {
  gbl.matchMedia = (query: string) => ({
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

if (typeof window !== "undefined") {
  const win = window as unknown as Record<string, unknown>;
  if (!win.ResizeObserver) win.ResizeObserver = ResizeObserverStub;
  if (!win.PointerEvent) win.PointerEvent = win.MouseEvent;
  if (!win.localStorage) win.localStorage = gbl.localStorage;
  if (!win.sessionStorage) win.sessionStorage = gbl.sessionStorage;
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
