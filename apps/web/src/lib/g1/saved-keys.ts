import { getAllAppCookieValues, getAppCookie, removeAppCookie, setAppCookie } from "../cookies";

// Cookies (not localStorage) so the active access key / session code ride along with every
// request and route loaders can read them synchronously before the component mounts - the same
// pattern routes/index.tsx already uses for the better-auth session cookie.
const SAVED_KEYS_STORAGE = "aloysius-admissions-application-keys";
const ACTIVE_KEY_STORAGE = "aloysius-admissions-application-key";
const ACTIVE_SESSION_CODE_STORAGE = "aloysius-admissions-application-session-code";

export function getSavedKeys(): string[] {
  // Normally exactly one cookie named SAVED_KEYS_STORAGE applies, but right after the
  // apex-domain/subdomain cookie-sharing change ships, a browser may still carry a
  // leftover host-only cookie alongside the new shared-domain one until the next write
  // (see cookies.ts). Union every occurrence rather than reading just one so a saved
  // key is never dropped during that transition.
  const stored = getAllAppCookieValues(SAVED_KEYS_STORAGE).flatMap((raw) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
    } catch {
      return [];
    }
  });
  const legacy = getAppCookie(ACTIVE_KEY_STORAGE);
  return [...new Set([...stored, ...(legacy ? [legacy] : [])])];
}

export function saveKey(key: string): void {
  const savedKeys = getSavedKeys();
  setAppCookie(SAVED_KEYS_STORAGE, JSON.stringify([...new Set([...savedKeys, key])]));
}

export function removeSavedKey(key: string): void {
  const remaining = getSavedKeys().filter((savedKey) => savedKey !== key);
  setAppCookie(SAVED_KEYS_STORAGE, JSON.stringify(remaining));
  if (getAppCookie(ACTIVE_KEY_STORAGE) === key) {
    removeAppCookie(ACTIVE_KEY_STORAGE);
  }
}

export function getActiveKey(): string {
  return getAppCookie(ACTIVE_KEY_STORAGE) ?? "";
}

export function getActiveSessionCode(): string {
  return getAppCookie(ACTIVE_SESSION_CODE_STORAGE) ?? "";
}

export function setActiveKey(key: string): void {
  setAppCookie(ACTIVE_KEY_STORAGE, key);
}

export function setActiveSessionCode(sessionCode: string): void {
  setAppCookie(ACTIVE_SESSION_CODE_STORAGE, sessionCode);
}

// Persists the resolved access key + session code for an application (as the active pair, and in
// the saved-keys list), the single write path every create/lookup flow should use.
export function setActiveApplication(key: string, sessionCode: string): void {
  setActiveKey(key);
  setActiveSessionCode(sessionCode);
  saveKey(key);
}

export function clearActiveKey(): void {
  removeAppCookie(ACTIVE_KEY_STORAGE);
  removeAppCookie(ACTIVE_SESSION_CODE_STORAGE);
}
