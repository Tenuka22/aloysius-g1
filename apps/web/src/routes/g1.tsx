import { createFileRoute } from "@tanstack/react-router";
import { client } from "@/utils/orpc";
import { HomeComponent } from "@/components/g1/home/home-page";

// Duplicate of routes/index.tsx's home route, addressable at /g1. Once a
// second admission logic exists, "/" becomes a picker between admission
// types and this route stays the dedicated G1 entry point.
function G1RouteComponent() {
 const { isAdmin, isSubAdmin } = Route.useLoaderData();
 return <HomeComponent isAdmin={isAdmin} isSubAdmin={isSubAdmin} />;
}

export const Route = createFileRoute("/g1")({
 // isAdmin/isSubAdmin decide whether the admin-panel/sub-admin-panel
 // shortcuts show, so they need a real per-request check rather than a
 // client-only hook. Goes through the oRPC API
 // (packages/api/src/routers/index.ts's session.isAdmin/isSubAdmin), which
 // resolves the session server-side via the shared oRPC context
 // (packages/api/src/context.ts) - no separate better-auth client call.
 loader: async () => {
 const [{ isAdmin }, { isSubAdmin }] = await Promise.all([client.session.isAdmin(), client.session.isSubAdmin()]);
 return { isAdmin, isSubAdmin };
 },
 component: G1RouteComponent,
});
