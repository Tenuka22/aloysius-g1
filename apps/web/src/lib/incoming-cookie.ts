import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

// Server-side `fetch` calls to our own API (oRPC, better-auth) have no
// browser cookie jar, so `credentials: "include"` is a no-op during SSR - 
// every server-rendered request would otherwise look anonymous even when the
// browser sent a valid session cookie. This forwards the incoming request's
// `Cookie` header explicitly. Client branch has nothing to forward: the
// browser attaches its own cookies via `credentials: "include"` already.
export const getIncomingCookieHeader = createIsomorphicFn()
  .server(() => getRequestHeader("cookie") ?? null)
  .client((): string | null => null);
