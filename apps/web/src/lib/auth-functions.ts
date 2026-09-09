import { auth } from "@aloysius-admissions/api/server";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Session lookup for route guards.
 *
 * Runs on the server and calls Better Auth directly, so `beforeLoad` resolves
 * the session without the app making an HTTP request back to itself. It also
 * avoids the trap the auth client falls into during SSR: a client is built once
 * at module load, but the base URL and cookie header are per-request values.
 */
export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  return auth.api.getSession({ headers: getRequest().headers });
});
