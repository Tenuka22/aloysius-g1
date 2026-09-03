import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@aloysius-g1/ui/components/card";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard")({
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery(context.orpc.privateData.queryOptions());
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();

  const privateData = useQuery(orpc.privateData.queryOptions());

  if (privateData.isPending) {
    return (
      <div className="grid place-items-center min-h-svh p-6">
        <Card className="w-full max-w-md p-8">
          <CardContent className="flex items-center gap-3">
            <Loader2 className="animate-spin text-primary" size={18} />
            <span className="text-sm text-muted-foreground">Loading dashboard…</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (privateData.error) {
    return (
      <div className="grid place-items-center min-h-svh p-6">
        <Card className="w-full max-w-md p-8 border-destructive/25">
          <CardContent className="text-sm text-destructive">
            Could not load dashboard: {privateData.error.message}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome {session.data?.user.name}</p>
      <p>API: {privateData.data?.message}</p>
    </div>
  );
}
