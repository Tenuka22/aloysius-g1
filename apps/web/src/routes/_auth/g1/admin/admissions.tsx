import { createFileRoute } from "@tanstack/react-router";
import { intakeYearSearchSchema } from "@/lib/g1/intake-year";
import { AdmissionsPage } from "@/components/g1/admin/admissions-view";

export const Route = createFileRoute("/_auth/g1/admin/admissions")({
  validateSearch: intakeYearSearchSchema,
  loaderDeps: ({ search }) => ({ intakeYear: search.intakeYear }),
  loader: async ({ context, deps }) => {
    const { intakeYear } = deps;
    await context.queryClient.prefetchQuery(context.orpc.admin.settings.get.queryOptions({ input: { intakeYear } }));
  },
  component: AdmissionsPage,
});
