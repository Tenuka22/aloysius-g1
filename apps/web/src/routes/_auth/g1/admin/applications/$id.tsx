import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@aloysius-admissions/ui/components/card";
import { Button } from "@aloysius-admissions/ui/components/button";
import { ApplicationForm } from "@/components/g1/application/application-form";
import { AdminApplicationView } from "@/components/g1/admin/admin-application-editor";
import { intakeYearSearchSchema } from "@/lib/g1/intake-year";
import { orpc } from "@/utils/orpc";
import { Spinner } from "@aloysius-admissions/ui/components/spinner";

const searchSchema = intakeYearSearchSchema.extend({ mode: z.enum(["edit"]).optional() });

export const Route = createFileRoute("/_auth/g1/admin/applications/$id")({
  validateSearch: searchSchema,
  loader: async ({ context, params }) => {
    await context.queryClient.prefetchQuery(context.orpc.admin.application.get.queryOptions({ input: { id: params.id } }));
  },
  component: AdminApplicationPage,
});

function AdminApplicationPage() {
  const { session } = Route.useRouteContext();
  const { id } = Route.useParams();
  const editing = Route.useSearch().mode === "edit";
  const role = session.data?.user.role;

  const detail = useQuery(orpc.admin.application.get.queryOptions({ input: { id } }));

  if (role !== "admin" && role !== "sub-admin") {
    return (
      <main className="grid place-items-center min-h-svh p-6">
        <Card className="w-full max-w-md gap-5 p-8">
          <CardHeader className="p-0">
            <CardTitle className="font-heading text-[clamp(1.8rem,4vw,2.5rem)]">Access required</CardTitle>
          </CardHeader>
          <Button variant="default" className="w-fit" render={<Link to="/admissions" />} nativeButton={false}>
            <ArrowLeft size={17} /> Back to dashboard
          </Button>
        </Card>
      </main>
    );
  }

  if (editing) {
    if (detail.isLoading) {
      return (
        <main className="grid min-h-svh place-items-center">
          <Spinner />
        </main>
      );
    }
    if (detail.isError || !detail.data) {
      return (
        <main className="grid min-h-svh place-items-center p-6">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-sm text-destructive">
              Could not load application: {detail.error?.message ?? "Not found"}
            </CardContent>
          </Card>
        </main>
      );
    }
    return (
      <ApplicationForm
        adminApplicationId={id}
        initialData={{
          // Admin edits never use the applicant-facing access key flow.
          // An empty key skips key-based saves; the form routes through
          // adminApplicationId → client.admin.application.update instead.
          key: "",
          code: detail.data.sessionCode,
          application: {
            data: detail.data.data,
            sessionCode: detail.data.sessionCode,
            submittedAt: detail.data.submittedAt,
          },
          // Null status means no submission-window restrictions — admin can
          // always edit regardless of whether the form window is open.
          status: null,
        }}
      />
    );
  }

  return <AdminApplicationView id={id} />;
}
