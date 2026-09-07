import { createFileRoute } from "@tanstack/react-router";
import { client } from "@/utils/orpc";
import { HomeComponent } from "@/components/home/home-page";

function HomeRouteComponent() {
  const { isAdmin, isSubAdmin } = Route.useLoaderData();
  return <HomeComponent isAdmin={isAdmin} isSubAdmin={isSubAdmin} />;
}

export const Route = createFileRoute("/")({
  // isAdmin/isSubAdmin decide whether the admin-panel/sub-admin-panel
  // shortcuts show, so they need a real per-request check rather than a
  // client-only hook. Goes through the oRPC API
  // (packages/api/src/routers/index.ts's session.isAdmin/isSubAdmin), which
  // resolves the session server-side via the shared oRPC context
  // (packages/api/src/context.ts) — no separate better-auth client call.
  loader: async () => {
    const [{ isAdmin }, { isSubAdmin }] = await Promise.all([client.session.isAdmin(), client.session.isSubAdmin()]);
    return { isAdmin, isSubAdmin };
  },
  component: HomeRouteComponent,
});
