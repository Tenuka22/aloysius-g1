import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { ApplicationForm } from "@/components/application/application-form";
import { client } from "@/utils/orpc";
import { getActiveKey, getActiveSessionCode, setActiveApplication } from "@/lib/saved-keys";

const applicationSearchSchema = z.object({
  key: z.string().optional(),
  code: z.string().optional(),
});

export const Route = createFileRoute("/application/")({
  validateSearch: applicationSearchSchema,
  loaderDeps: ({ search }) => ({ key: search.key, code: search.code }),
  // Resolves the accessKey/sessionCode (search param or cookie) and loads the
  // application + submission-window status isomorphically, so a returning
  // applicant's draft is part of the server-rendered HTML — no client fetch,
  // no loading gate, no localStorage. A brand-new visit (no key at all)
  // creates the draft row here and redirects to the canonical `?key=&code=`
  // URL, so ApplicationForm always mounts with a resolved key.
  loader: async ({ deps }) => {
    const key = deps.key || getActiveKey();
    const code = deps.code || getActiveSessionCode();
    if (!key) {
      const created = await client.application.create({ data: {} });
      setActiveApplication(created.accessKey, created.sessionCode);
      throw redirect({ to: "/application", search: { key: created.accessKey, code: created.sessionCode } });
    }
    const [application, status] = await Promise.all([
      client.application.get({ accessKey: key }).catch(() => null),
      client.application.status().catch(() => null),
    ]);
    return { key, code: code || "", application, status };
  },
  component: ApplicationIndexPage,
});

function ApplicationIndexPage() {
  const initialData = Route.useLoaderData();
  return <ApplicationForm initialData={initialData} />;
}
