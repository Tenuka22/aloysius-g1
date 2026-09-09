import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { ApplicationForm } from "@/components/g1/application/application-form";
import { client } from "@/utils/orpc";

const applicationSearchSchema = z.object({
  key: z.string().optional(),
  code: z.string().optional(),
});

export const Route = createFileRoute("/application/")({
  validateSearch: applicationSearchSchema,
  loaderDeps: ({ search }) => ({ key: search.key, code: search.code }),
  loader: async ({ deps }) => {
    if (!deps.key || !deps.code) {
      const created = await client.application.create({ data: {} });
      throw redirect({ to: "/application", search: { key: created.accessKey, code: created.sessionCode } });
    }
    const [application, status] = await Promise.all([
      client.application.get({ accessKey: deps.key }).catch(() => null),
      client.application.status().catch(() => null),
    ]);
    return { key: deps.key, code: deps.code, application, status };
  },
  component: ApplicationIndexPage,
});

function ApplicationIndexPage() {
  const initialData = Route.useLoaderData();
  return <ApplicationForm initialData={initialData} />;
}
