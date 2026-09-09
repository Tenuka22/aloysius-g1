import { ORPCError } from "@orpc/client";

/**
 * Expected, intentionally-thrown business errors (e.g. "access key not found",
 * "unauthorized") have a client status (4xx) and are not bugs - logging every
 * mistyped key or permission check would flood the server log. Only surface
 * genuine server-side failures (5xx / unclassified thrown errors) here.
 */
export function logUnexpectedError(
  error: unknown,
  options?: { log?: (error: unknown) => void } | ((error: unknown) => void),
): void {
  if (error instanceof ORPCError && error.status < 500) return;
  if (typeof options === "function") {
    options(error);
  } else {
    (options?.log ?? console.error)(error);
  }
}
