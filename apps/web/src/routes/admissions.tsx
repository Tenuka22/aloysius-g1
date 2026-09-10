import { createFileRoute } from "@tanstack/react-router";
import { client } from "@/utils/orpc";
import { HomeComponent } from "@/components/g1/home/home-page";
import { ErrorState } from "@/components/error-state";

// Grade 1 admissions dashboard. "/" is the school website's landing page, so
// this route is the dedicated entry point for the G1 application flow.
function G1AdmissionsRouteComponent() {
  const { isAdmin, isSubAdmin } = Route.useLoaderData();
  return <HomeComponent isAdmin={isAdmin} isSubAdmin={isSubAdmin} />;
}

export const Route = createFileRoute("/admissions")({
  head: () => ({
    meta: [
      { title: "St. Aloysius' College — Grade 1 Admissions" },
      {
        name: "description",
        content: "Online admissions portal for Grade 1 applications to St. Aloysius' College, Galle.",
      },
    ],
  }),
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
  errorComponent: (props) => <ErrorState {...props} />,
  component: G1AdmissionsRouteComponent,
});
