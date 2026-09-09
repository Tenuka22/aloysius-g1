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
 */
export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined"
      ? "http://localhost/api/auth"
      : new URL("/api/auth", window.location.origin).toString(),
  plugins: [multiSessionClient()],
});
