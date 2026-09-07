// Client-writable, non-httpOnly cookie access for saved application access keys / session codes.
// Real isomorphic implementation now that apps/web runs on TanStack Start: the `.server()` branch
// reads/writes the actual request/response cookie headers via `@tanstack/react-start/server`, and
// the `.client()` branch falls back to `document.cookie` for client-side navigations.
import { createIsomorphicFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

const DEFAULT_MAX_AGE_DAYS = 365;

export const getAppCookie = createIsomorphicFn()
  .server((name: string) => getCookie(name) ?? null)
  .client((name: string) => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(name)}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  });

export const setAppCookie = createIsomorphicFn()
  .server((name: string, value: string, maxAgeDays: number = DEFAULT_MAX_AGE_DAYS) => {
    setCookie(name, value, { path: "/", maxAge: maxAgeDays * 24 * 60 * 60, sameSite: "lax" });
  })
  .client((name: string, value: string, maxAgeDays: number = DEFAULT_MAX_AGE_DAYS) => {
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeDays * 24 * 60 * 60}; samesite=lax`;
  });

export const removeAppCookie = createIsomorphicFn()
  .server((name: string) => {
    deleteCookie(name, { path: "/" });
  })
  .client((name: string) => {
    document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; samesite=lax`;
  });
