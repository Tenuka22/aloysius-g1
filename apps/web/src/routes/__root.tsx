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
        title: "aloysius-admissions",
      },
      {
        name: "description",
        content: "aloysius-admissions is a web application",
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
  // Client-only: this hydrates a module-level cache from a network call, which
  // would leak across concurrent requests if it ran during server rendering.
  useEffect(() => {
    void refreshSchoolCoordinateOverrides();
  }, []);
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const [client] = useState<AppRouterClient>(() => createORPCClient(link));
  const navigate = useNavigate();
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
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
        {/*<TanStackRouterDevtools position="bottom-left" />
        <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />*/}
        <Scripts />
      </body>
    </html>
  );
}
