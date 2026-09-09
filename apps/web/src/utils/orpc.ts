import type { AppRouterClient } from "@aloysius-admissions/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest, getRequestHeaders } from "@tanstack/react-start/server";
import { toast } from "sonner";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.skipErrorToast) return;
        toast.error(`Error: ${error.message}`, {
          action: {
            label: "retry",
            onClick: () => {
              query.invalidate();
            },
          },
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        toast.error(`Mutation failed: ${error.message}`);
      },
    }),
  });
}

export const queryClient = createQueryClient();

/**
 * The RPC endpoint lives on this app's own origin, so the browser just uses a
 * relative URL. During SSR there is no origin and no cookie jar, so the link
 * resolves both from the incoming request instead of forwarding cookies by
 * hand the way the separate-server setup had to.
 */
export const link = createIsomorphicFn()
  // Absolute on both sides: oRPC resolves this with `new URL(...)`, which
  // throws on a bare path because there is no base to resolve it against.
  .client(() => new RPCLink({ url: new URL("/api/rpc", window.location.origin).toString() }))
  .server(
    () =>
      new RPCLink({
        // Absolute during SSR: there is no document to resolve a relative URL
        // against. Resolved per request so it works behind any host.
        url: () => new URL("/api/rpc", new URL(getRequest().url).origin).toString(),
        headers: () => getRequestHeaders(),
      }),
  )();

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
