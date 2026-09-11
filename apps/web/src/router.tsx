import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, stringifySearchWith } from "@tanstack/react-router";

import Loader from "./components/loader";
import { NotFoundState } from "./components/not-found-state";
import { routeTree } from "./routeTree.gen";
import { createQueryClient, orpc } from "./utils/orpc";

/**
 * Plain `key=value` search serialization (no JSON quoting).
 *
 * The router's default serializer JSON-stringifies any string that would
 * round-trip through JSON.parse, which turns `intakeYear=2027` into
 * `intakeYear=%222027%22`. Those quoted values then show up verbatim in
 * address-bar URLs, break hand-written links, and used to leak into query
 * inputs as `'"2027"'`. Every search param in this app is a plain string or
 * boolean, so plain encoding round-trips losslessly.
 */
const plainStringifySearch = stringifySearchWith(
  (value) => (typeof value === "string" ? value : JSON.stringify(value)),
  () => {
    throw new Error("search params are plain strings; never JSON-parse them");
  },
);

export function getRouter() {
  // A fresh QueryClient per router instance - never the shared module-level
  // singleton from utils/orpc.ts. The server process is long-running and
  // handles many concurrent requests from different users; a shared
  // QueryClient would let one request's cache/dehydration state leak into
  // another's SSR response, which is exactly what caused the intermittent
  // "Cannot read properties of undefined (reading 'manifest')" client
  // hydration crash on direct/hard loads of /application. On the client,
  // getRouter() runs exactly once per page load, so a fresh instance there
  // is equally correct (and matches TanStack Start's own guidance).
  const queryClient = createQueryClient();
  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <NotFoundState />,
    stringifySearch: plainStringifySearch,
    context: { orpc, queryClient },
    Wrap: function WrapComponent({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    },
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
