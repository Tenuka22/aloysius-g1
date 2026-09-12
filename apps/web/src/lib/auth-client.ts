import { multiSessionClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client, talking to `/api/auth` on this app's own
 * origin.
 *
 * It is deliberately not used during SSR. The client is constructed once at
 * module load, but a server-rendered request needs a per-request origin and
 * cookie header, and Better Auth rejects a relative base URL outright. Route
 * guards use `getSession` in `./auth-functions` instead, which calls the auth
 * API directly on the server with no HTTP hop.
 *
 * Nothing here needs to mirror `advanced.cookiePrefix` ("aloysius-admissions")
 * set on the server in `packages/auth`: `createAuthClient`'s config
 * (`getClientConfig`) never reads or needs a cookie name - it only builds
 * `baseURL`/`fetchOptions`/plugins, and every request goes out with
 * `credentials: "include"`, so the browser attaches whatever's already in its
 * cookie jar regardless of what name this client thinks it has. The one
 * client-side identifier better-auth does hardcode - a `"better-auth.message"`
 * localStorage key used to pulse other tabs to refetch their session - has no
 * public option to rename and is harmless to share with the separate
 * aloysius-web CMS app even if a tab of each is ever open on the same origin:
 * it only ever triggers "refetch your own session from your own cookie",
 * never carries or reads the other app's session data.
 */
export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined"
      ? "http://localhost/api/auth"
      : new URL("/api/auth", window.location.origin).toString(),
  plugins: [multiSessionClient()],
});
