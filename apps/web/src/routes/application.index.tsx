import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@aloysius-admissions/ui/components/button";
import { ApplicationForm } from "@/components/g1/application/application-form";
import { useTranslation } from "@/lib/i18n";
import { client, orpc } from "@/utils/orpc";

const applicationSearchSchema = z.object({
  key: z.string().optional(),
  code: z.string().optional(),
});

export const Route = createFileRoute("/application/")({
  validateSearch: applicationSearchSchema,
  loaderDeps: ({ search }) => ({ key: search.key }),
  loader: async ({ deps }) => {
    if (deps.key) return;
    // No access key at all: nothing to resume, so start a fresh draft. This
    // also covers what `/application/access` used to be the second step of -
    // loading by key is handled entirely client-side below, on this same
    // route, so a returning applicant's draft (which can carry an arbitrary
    // amount of nested form data) never has to be serialized into the SSR
    // payload - TanStack Start's dehydration chokes on some of that data's
    // shape (see the seroval crash this replaced).
    const created = await client.application.create({ data: {} });
    throw redirect({ to: "/application", search: { key: created.accessKey, code: created.sessionCode } });
  },
  component: ApplicationIndexPage,
});

function ApplicationIndexPage() {
  const { t } = useTranslation();
  const { key, code } = Route.useSearch();
  // `key` is only briefly empty here: the loader above redirects to a freshly
  // created draft's key before this ever renders without one.
  const applicationQuery = useQuery({
    ...orpc.application.get.queryOptions({ input: { accessKey: key ?? "" } }),
    enabled: Boolean(key),
    retry: false,
    // An unresolved key (bad link, stale QR code, since-removed application)
    // is an expected, explicitly-handled state below - not an unexpected
    // failure worth an error toast on top of the "not found" screen.
    meta: { skipErrorToast: true },
  });
  const statusQuery = useQuery(orpc.application.status.queryOptions());

  if (!key || applicationQuery.isPending || statusQuery.isPending) {
    return <main className="grid min-h-svh place-items-center p-6 text-sm text-muted-foreground">{t("application.loading")}</main>;
  }
  if (applicationQuery.isError) return <KeyNotFoundState />;
  return (
    <ApplicationForm
      initialData={{
        key,
        code: code ?? applicationQuery.data.sessionCode,
        application: applicationQuery.data,
        status: statusQuery.data ?? null,
      }}
    />
  );
}

function KeyNotFoundState() {
  const { t } = useTranslation();
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <div className="grid max-w-md gap-4 text-center">
        <h1 className="font-heading text-2xl">{t("application.keyNotFound.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("application.keyNotFound.description")}</p>
        <Link to="/admissions" className="mx-auto">
          <Button type="button">{t("application.keyNotFound.backToDashboard")}</Button>
        </Link>
      </div>
    </main>
  );
}
