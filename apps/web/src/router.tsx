import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, stringifySearchWith } from "@tanstack/react-router";

import Loader from "./components/loader";
import { NotFoundState } from "./components/not-found-state";
import { routeTree } from "./routeTree.gen";
import { orpc, queryClient } from "./utils/orpc";

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
