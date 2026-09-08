import type { AppRouterClient } from "@aloysius-admissions/api/routers/index";
import { env } from "@aloysius-admissions/env/web";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { getIncomingCookieHeader } from "@/lib/incoming-cookie";
import { toast } from "sonner";
import { getServerUrl } from "./server-url";

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

export const link = new RPCLink({
  url: `${getServerUrl(env.VITE_SERVER_URL)}/rpc`,
  fetch(url, options) {
    const cookie = getIncomingCookieHeader();
    if (cookie) {
      return fetch(url, {
        ...(options as RequestInit),
        headers: { ...(options as RequestInit)?.headers, cookie },
      });
    }
    return fetch(url, {
      ...options,
      credentials: "include",
    });
  },
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
