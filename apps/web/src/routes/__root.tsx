import type { AppRouterClient } from "@aloysius-admissions/api/routers/index";
import { Toaster } from "@aloysius-admissions/ui/components/sonner";
import { createORPCClient } from "@orpc/client";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext, useNavigate } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { AuthProvider } from "@/components/auth/auth-provider";
import { I18nProvider } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { multiSessionPlugin } from "@/lib/auth/multi-session-plugin";
import { authClient } from "@/lib/auth-client";
import { clearChunkReloadGuard } from "@/lib/chunk-reload";
import { refreshSchoolCoordinateOverrides } from "@/lib/g1/school-coordinates";
import { link, orpc } from "@/utils/orpc";
import { ErrorState } from "@/components/error-state";

import "../index.css";

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  errorComponent: (props) => <ErrorState {...props} />,
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1.0",
      },
      {
        title: "St. Aloysius' College, Galle",
      },
      {
        name: "description",
        content: "Official website of St. Aloysius' College, Galle, Sri Lanka.",
      },
      {
        name: "theme-color",
        content: "#0b4619",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "any",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "192x192",
        href: "/icon-192.png",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
      },
    ],
  }),
});

function RootComponent() {
  // Client-only: this hydrates a module-level cache from a network call, which
  // would leak across concurrent requests if it ran during server rendering.
  useEffect(() => {
    void refreshSchoolCoordinateOverrides();
  }, []);
  // Reaching this render means the app booted past whatever chunk load a
  // prior `vite:preloadError` reload was recovering from - drop the guard so
  // a genuinely new failure later in this session gets one fresh retry too.
  useEffect(() => {
    clearChunkReloadGuard();
  }, []);
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
        {/*<TanStackRouterDevtools position="bottom-left" />
        <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />*/}
        <Scripts />
      </body>
    </html>
  );
}

function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  const [client] = useState<AppRouterClient>(() => createORPCClient(link));
  const navigate = useNavigate();
  return (
    <AuthProvider
      authClient={authClient}
      navigate={navigate}
      Link={({ href, ...props }) => <Link to={href} {...props} />}
      plugins={[multiSessionPlugin()]}
    >
      <I18nProvider>
        <div className="h-svh overflow-auto">{children}</div>
        <Toaster richColors />
        <LocaleSwitcher />
      </I18nProvider>
    </AuthProvider>
  );
}
