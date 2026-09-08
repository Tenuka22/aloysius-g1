import { useMemo } from "react";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, ChevronRight, ShieldAlert, UserRound } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { orpc } from "@/utils/orpc";
import { normalizeDraft } from "@/lib/g1/application-store";
import { scoreCategory } from "@/lib/g1/scoring";
import { Badge } from "@aloysius-admissions/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@aloysius-admissions/ui/components/card";
import { type AdmissionStatus, type AdmissionDetail, CATEGORY_LABELS } from "./admissions";

export const Route = createFileRoute("/_auth/g1/admin/admissions/$id")({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.prefetchQuery(context.orpc.admin.admissions.get.queryOptions({ input: { id: params.id } })),
      context.queryClient.prefetchQuery(context.orpc.admin.admissions.getMarks.queryOptions({ input: { applicationId: params.id } })),
    ]);
  },
  component: AdmissionCategorySelectPage,
});

function StatusBadge({ status, banned }: { status: AdmissionStatus; banned: boolean }) {
  if (banned) return <Badge variant="destructive">Banned</Badge>;
  if (status === "verified") return <Badge variant="default">Verified</Badge>;
  if (status === "fake") return <Badge variant="destructive">Potentially fake</Badge>;
  return <Badge variant="secondary">Pending review</Badge>;
}

function AdmissionCategorySelectPage() {
  const { id } = Route.useParams();
  const location = useLocation();

  if (location.pathname !== `/g1/admin/admissions/${id}`) {
    return <Outlet />;
  }

  const detail = useQuery({
    ...orpc.admin.admissions.get.queryOptions({ input: { id } }),
  });

  const marksQuery = useQuery({
    ...orpc.admin.admissions.getMarks.queryOptions({ input: { applicationId: id } }),
  });

  const data = detail.data as AdmissionDetail | undefined;

  const adminMarksMap = useMemo(() => {
    const map = new Map<string, number>();
    if (marksQuery.data) {
      for (const mark of marksQuery.data) {
        map.set(mark.categoryType, mark.total);
      }
    }
    return map;
  }, [marksQuery.data]);

  if (detail.isLoading) {
    return (
      <main className="min-h-svh p-6 md:p-10 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
        <Link to="/g1/admin/admissions" search={true} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">← Back to admissions</Link>
        <Card><CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground"><ClipboardCheck className="text-primary" size={18} /> Loading applicant record…</CardContent></Card>
      </main>
    );
  }

  if (detail.error || !data) {
    return (
      <main className="min-h-svh p-6 md:p-10 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
        <Link to="/g1/admin/admissions" search={true} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">← Back to admissions</Link>
        <Card className="border-destructive/25"><CardContent className="flex items-start gap-2 p-6 text-sm text-destructive"><ShieldAlert size={17} className="mt-0.5 shrink-0" /> Could not load applicant: {detail.error?.message ?? "Not found"}</CardContent></Card>
      </main>
    );
  }

  const draftInput = data.data as Record<string, unknown>;
  const draft = normalizeDraft(draftInput);

  return (
    <main className="min-h-svh p-6 md:p-10 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
      <Link to="/g1/admin/admissions" search={true} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">← Back to admissions</Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 mb-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><UserRound size={19} /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-primary">Select category</p>
            <h2 className="font-heading text-2xl">{data.applicantName}</h2>
            <p className="text-sm text-muted-foreground">Session {data.sessionCode} · Submitted {data.submittedAt ? new Date(data.submittedAt).toLocaleString() : "Not submitted"}</p>
          </div>
        </div>
        <StatusBadge status={data.admissionStatus} banned={data.isBanned} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category entries</CardTitle>
          <p className="text-sm text-muted-foreground">Select a category to open the interview workspace for scoring and review.</p>
        </CardHeader>
        <CardContent className="grid gap-3">
          {draft.categories.length === 0 && <p className="text-sm text-muted-foreground">No category entries were submitted.</p>}
          {draft.categories.map((category, categoryIndex) => {
            const score = scoreCategory(category);
            const adminTotal = adminMarksMap.get(category.categoryType) ?? 0;
            const hasAdminMarks = adminMarksMap.has(category.categoryType);
            const sameTypeCount = draft.categories.filter((c) => c.categoryType === category.categoryType).length;
            const sameTypeIndex = draft.categories.filter((c) => c.categoryType === category.categoryType && draft.categories.indexOf(c) < categoryIndex).length + 1;
            return (
              <Link
                key={category.id}
                to="/g1/admin/admissions/$id/$categoryId"
                params={{ id: data.id, categoryId: category.id }}
                className="group flex items-center justify-between gap-4 rounded-xl border border-border p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">
                      {CATEGORY_LABELS[category.categoryType] ?? category.categoryType}
                      {sameTypeCount > 1 && <span className="text-muted-foreground"> ({sameTypeIndex}/{sameTypeCount})</span>}
                    </h3>
                    <Badge variant="outline">{score.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} indicative</Badge>
                    {hasAdminMarks ? (
                      <Badge variant="default">{adminTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} admin</Badge>
                    ) : (
                      <Badge variant="secondary">0 admin</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Object.keys(category.scoringInputs).length} fields captured
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </main>
  );
}
