import type { AppRouterClient } from "@aloysius-g1/api/routers/index";
import { Toaster } from "@aloysius-g1/ui/components/sonner";
import { createORPCClient } from "@orpc/client";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HeadContent, Link, Outlet, createRootRouteWithContext, useNavigate } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useState } from "react";

import { AuthProvider } from "@/components/auth/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { authClient } from "@/lib/auth-client";
import { link, orpc } from "@/utils/orpc";

import "../index.css";

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "aloysius-g1",
      },
      {
        name: "description",
        content: "aloysius-g1 is a web application",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
});

function RootComponent() {
  const [client] = useState<AppRouterClient>(() => createORPCClient(link));
  const navigate = useNavigate();
  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        <AuthProvider
          authClient={authClient}
          navigate={navigate}
          Link={({ href, ...props }) => <Link to={href} {...props} />}
        >
          <div className="min-h-svh">
            <Outlet />
          </div>
          <Toaster richColors />
        </AuthProvider>
      </ThemeProvider>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </>
  );
}
