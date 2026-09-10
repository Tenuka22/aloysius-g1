import { auth } from "./server";

export type CreateContextOptions = {
  /** Incoming request headers; the session cookie is read from these. */
  headers: Headers;
};

/**
 * Builds the oRPC request context.
 *
 * Takes plain `Headers` rather than a framework request object so the router
 * can be mounted from a TanStack Start server route without the API package
 * depending on a server framework.
 */
export async function createContext({ headers }: CreateContextOptions) {
  const session = await auth.api.getSession({ headers });
  return {
    auth: null,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
