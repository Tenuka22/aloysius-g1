import { auth } from "@aloysius-admissions/api/server";
import { createFileRoute } from "@tanstack/react-router";
import { ensureServerBootstrap } from "@/lib/server/bootstrap";

/**
 * Better Auth's handler, mounted on the app's own origin.
 *
 * This replaced a separate Hono service on another port; because the app and
 * the API now share an origin there is no CORS layer and the session cookie is
 * a plain same-site cookie.
 */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        await ensureServerBootstrap();
        return auth.handler(request);
      },
      POST: async ({ request }: { request: Request }) => {
        await ensureServerBootstrap();
        return auth.handler(request);
      },
    },
  },
});
