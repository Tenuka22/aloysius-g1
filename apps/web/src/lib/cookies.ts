// Client-writable, non-httpOnly cookie access for saved application access keys / session codes.
// Real isomorphic implementation now that apps/web runs on TanStack Start: the `.server()` branch
// reads/writes the actual request/response cookie headers via `@tanstack/react-start/server`, and
// the `.client()` branch falls back to `document.cookie` for client-side navigations.
import { createIsomorphicFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, getRequestHeaders, getRequestHost, setCookie } from "@tanstack/react-start/server";

const DEFAULT_MAX_AGE_DAYS = 365;

// `aloysiuscollege.lk` and `admissions.aloysiuscollege.lk` currently serve the exact
// same build (the admissions portal is mid-migration from the apex-domain path to its
// own subdomain), so every app cookie - most importantly the saved-applications
// access-key list - is scoped to the whole registrable domain rather than just the
// host that set it. Without this, a family who saved an application from one origin
// finds it silently missing the moment they load the other, since a plain (host-only)
// cookie never crosses subdomains. Any other host (localhost in dev/test, or a future
// unrelated domain) is untouched and keeps a normal host-only cookie.
const SHARED_COOKIE_ROOT = "aloysiuscollege.lk";

export function sharedCookieDomain(hostname: string): string | undefined {
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  return host === SHARED_COOKIE_ROOT || host.endsWith(`.${SHARED_COOKIE_ROOT}`) ? SHARED_COOKIE_ROOT : undefined;
}

// A raw `Cookie` request header / `document.cookie` string can legitimately contain the
// same cookie name more than once - once per distinct (domain, path) it was set under.
// That is exactly the state a browser is in after this domain-sharing change ships: the
// pre-existing host-only cookie from before the change stays right where it is (nothing
// here ever deletes it - see setAppCookie) alongside the new shared-domain one, until it
// either expires on its own or an explicit removeAppCookie call clears both. Returns
// every value found, oldest-write-first per the browser's own cookie ordering.
export function extractAllCookieValues(rawCookieHeader: string, name: string): string[] {
  const encodedName = encodeURIComponent(name);
  const values: string[] = [];
  for (const part of rawCookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== encodedName) continue;
    values.push(decodeURIComponent(part.slice(eq + 1)));
  }
  return values;
}

export const getAppCookie = createIsomorphicFn()
  .server((name: string) => getCookie(name) ?? null)
  .client((name: string) => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(name)}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  });

// Callers that accumulate a list (the saved-keys cookie) should union across every
// value this returns so nothing saved under a leftover host-only cookie is ever lost;
// callers of a single active value can keep using `getAppCookie` as-is.
export const getAllAppCookieValues = createIsomorphicFn()
  .server((name: string) => extractAllCookieValues(getRequestHeaders().get("cookie") ?? "", name))
  .client((name: string) => extractAllCookieValues(document.cookie, name));

export const setAppCookie = createIsomorphicFn()
  .server((name: string, value: string, maxAgeDays: number = DEFAULT_MAX_AGE_DAYS) => {
    const domain = sharedCookieDomain(getRequestHost());
    setCookie(name, value, { path: "/", maxAge: maxAgeDays * 24 * 60 * 60, sameSite: "lax", domain });
  })
  .client((name: string, value: string, maxAgeDays: number = DEFAULT_MAX_AGE_DAYS) => {
    const domain = sharedCookieDomain(window.location.hostname);
    const encodedName = encodeURIComponent(name);
    const base = `${encodedName}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeDays * 24 * 60 * 60}; samesite=lax`;
    // A pre-existing host-only cookie of the same name (set before this domain-sharing
    // change shipped) is deliberately left alone here - getAllAppCookieValues/
    // getSavedKeys() already union across it and this new shared-domain cookie, so
    // nothing is lost either way, and it expires on its own within DEFAULT_MAX_AGE_DAYS
    // without this write path ever deleting anything.
    document.cookie = domain ? `${base}; domain=${domain}` : base;
  });

export const removeAppCookie = createIsomorphicFn()
  .server((name: string) => {
    const domain = sharedCookieDomain(getRequestHost());
    deleteCookie(name, { path: "/" });
    if (domain) deleteCookie(name, { path: "/", domain });
  })
  .client((name: string) => {
    const domain = sharedCookieDomain(window.location.hostname);
    document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; samesite=lax`;
    if (domain) document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; samesite=lax; domain=${domain}`;
  });
