import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@aloysius-admissions/ui/components/button";
import { ApplicationForm } from "@/components/g1/application/application-form";
import { useTranslation } from "@/lib/i18n";
import { client } from "@/utils/orpc";

const applicationSearchSchema = z.object({
  key: z.string().optional(),
  code: z.string().optional(),
});

export const Route = createFileRoute("/application/")({
  validateSearch: applicationSearchSchema,
  loaderDeps: ({ search }) => ({ key: search.key, code: search.code }),
  loader: async ({ deps }) => {
    if (!deps.key) {
      // No access key at all: nothing to resume, so start a fresh draft.
      // This also covers what `/application/access` used to be the second
      // step of - loading by key is now handled below, on this same route.
      const created = await client.application.create({ data: {} });
      throw redirect({ to: "/application", search: { key: created.accessKey, code: created.sessionCode } });
    }
    // A key alone (from "load with key" or a scanned QR code) is enough to
    // resolve the application - the session code is only a human-friendly
    // label, fetched here if the URL did not already carry it.
    const [application, status] = await Promise.all([
      client.application.get({ accessKey: deps.key }).catch(() => null),
      client.application.status().catch(() => null),
    ]);
    if (!application) {
      // A key was given but does not resolve to a real application. Say so
      // explicitly rather than silently seeding a blank draft under that key:
      // saves against an unknown key fail server-side anyway, so surfacing
      // the problem now is kinder than a mysterious "save failed" later.
      return { key: deps.key, code: deps.code ?? null, application: null, status, keyNotFound: true as const };
    }
    return {
      key: deps.key,
      code: deps.code ?? application.sessionCode,
      application,
      status,
      keyNotFound: false as const,
    };
  },
  component: ApplicationIndexPage,
});

function ApplicationIndexPage() {
  const initialData = Route.useLoaderData();
  if (initialData.keyNotFound) return <KeyNotFoundState />;
  return <ApplicationForm initialData={initialData} />;
}

function KeyNotFoundState() {
  const { t } = useTranslation();
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <div className="grid max-w-md gap-4 text-center">
        <h1 className="font-heading text-2xl">{t("application.keyNotFound.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("application.keyNotFound.description")}</p>
        <Link to="/g1-admissions" className="mx-auto">
          <Button type="button">{t("application.keyNotFound.backToDashboard")}</Button>
        </Link>
      </div>
    </main>
  );
}
