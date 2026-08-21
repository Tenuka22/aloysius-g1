const SAVED_KEYS_STORAGE = "aloysius-g1-application-keys";
const ACTIVE_KEY_STORAGE = "aloysius-g1-application-key";
const ACTIVE_SESSION_CODE_STORAGE = "aloysius-g1-application-session-code";

export function getSavedKeys(): string[] {
  if (typeof window === "undefined") return [];
  let stored: unknown = [];
  try {
    stored = JSON.parse(window.localStorage.getItem(SAVED_KEYS_STORAGE) ?? "[]");
  } catch {
    stored = [];
  }
  const legacy = window.localStorage.getItem(ACTIVE_KEY_STORAGE);
  return [
    ...new Set([
      ...(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string") : []),
      ...(legacy ? [legacy] : []),
    ]),
  ];
}

export function saveKey(key: string): void {
  const savedKeys = getSavedKeys();
  window.localStorage.setItem(SAVED_KEYS_STORAGE, JSON.stringify([...new Set([...savedKeys, key])]));
}

export function removeSavedKey(key: string): void {
  const remaining = getSavedKeys().filter((savedKey) => savedKey !== key);
  window.localStorage.setItem(SAVED_KEYS_STORAGE, JSON.stringify(remaining));
  if (window.localStorage.getItem(ACTIVE_KEY_STORAGE) === key) {
    window.localStorage.removeItem(ACTIVE_KEY_STORAGE);
  }
}

export function clearActiveKey(): void {
  window.localStorage.removeItem(ACTIVE_KEY_STORAGE);
  window.localStorage.removeItem(ACTIVE_SESSION_CODE_STORAGE);
}