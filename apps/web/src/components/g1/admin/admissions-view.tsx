import { useEffect, useMemo, useState } from "react";
import { Outlet, getRouteApi, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { consumeEventIterator } from "@orpc/client";
import { type ColumnDef, type ColumnFiltersState, type PaginationState, type SortingState } from "@tanstack/react-table";
import { CheckCircle2, ClipboardCheck, FileWarning, ShieldAlert } from "lucide-react";
import { client, orpc } from "@/utils/orpc";
import { Badge } from "@aloysius-admissions/ui/components/badge";
import { Button } from "@aloysius-admissions/ui/components/button";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aloysius-admissions/ui/components/card";
import { Input } from "@aloysius-admissions/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aloysius-admissions/ui/components/select";

import {
  DataTable,
  DataTableColumnHeader,
  DataTablePagination,
  DataTableViewOptions,
} from "@aloysius-admissions/ui/components/data-table";


// This component and the shared types/labels below live outside the routes
// directory so the route file (`admissions.tsx`) can export only its `Route`.
// TanStack Router only code-splits a route's component when the route file has
// no other exports; keeping the page here is what lets it split.
const Route = getRouteApi("/_auth/g1/admin/admissions");

export type AdmissionStatus = "pending" | "verified" | "fake" | "under_interview";
export type FlagEntry = { type: "field" | "input" | "location"; key: string; label: string };
export type AdmissionSummary = {
  id: string;
  applicantName: string;
  birthCertificateNumber: string;
  sessionCode: string;
  guardianNic: string;
  submittedAt: Date | null;
  updatedAt: Date;
  categoryCount: number;
  categoryTypes: string[];
  admissionStatus: AdmissionStatus;
  isBanned: boolean;
  banReason: string | null;
  admissionUpdatedAt: Date | null;
  flags: FlagEntry[];
};
export type AdmissionDetail = AdmissionSummary & {
  interviewNotes: string;
  data: Record<string, unknown>;
  createdAt: Date;
};

type StatusFilter = "all" | AdmissionStatus | "banned";
const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All applicants",
  pending: "Pending review",
  verified: "Verified",
  fake: "Potentially fake",
  under_interview: "Under interview",
  banned: "Banned applicants",
};

export const CATEGORY_LABELS: Record<string, string> = {
  "6.1": "6.1 - Residence Verification & Proximity",
  "6.2": "6.2 - Alumni",
  "6.3": "6.3 - Siblings",
  "6.4": "6.4 - Education Sector / Teaching Staff",
  "6.5": "6.5 - Transfer Applications",
  "6.6": "6.6 - Foreign Employment",
};

function StatusBadge({ status, banned }: { status: AdmissionStatus; banned: boolean }) {
  if (banned) return <Badge variant="destructive">Banned</Badge>;
  if (status === "verified") return <Badge variant="default">Verified</Badge>;
  if (status === "fake") return <Badge variant="destructive">Potentially fake</Badge>;
  return <Badge variant="secondary">Pending review</Badge>;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof ClipboardCheck }) {
  return <div className="grid gap-2 rounded-xl border bg-card p-4 shadow-[0_10px_30px_color-mix(in_oklch,var(--foreground)_5%,transparent)]"><Icon className="text-primary" size={19} /><span className="text-xs text-muted-foreground">{label}</span><strong className="font-heading text-3xl">{value.toLocaleString()}</strong></div>;
}

export function AdmissionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { intakeYear } = Route.useSearch();
  const settings = useQuery(orpc.admin.settings.get.queryOptions({ input: { intakeYear } }));
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 100 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const closesAt = settings.data?.closesAt ? new Date(settings.data.closesAt) : null;
  const windowClosed = closesAt ? Date.now() >= closesAt.getTime() : false;


  const searchQuery = typeof columnFilters.find((f) => f.id === "query")?.value === "string"
    ? (columnFilters.find((f) => f.id === "query")!.value as string)
    : "";
  const statusFilter = typeof columnFilters.find((f) => f.id === "status")?.value === "string"
    ? (columnFilters.find((f) => f.id === "status")!.value as string)
    : "all";

  const admissions = useQuery({
    ...orpc.admin.admissions.list.queryOptions({
      input: {
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        query: searchQuery,
        status: statusFilter as StatusFilter,
        intakeYear,
      },
    }),
    enabled: true,
  });

  const items = (admissions.data?.items ?? []) as AdmissionSummary[];
  const pageCount = admissions.data ? Math.ceil(admissions.data.total / admissions.data.pageSize) : 0;

  useEffect(() => {
    const controller = new AbortController();
    const cancel = consumeEventIterator(client.application.liveCount(undefined, { signal: controller.signal }), {
      onEvent: () => { void admissions.refetch(); },
      onError: () => undefined,
    });
    return () => { controller.abort(); void cancel().catch(() => undefined); };
  }, []);

  const counts = useMemo(() => ({ total: admissions.data?.total ?? 0, verified: items.filter((item) => item.admissionStatus === "verified").length, pending: items.filter((item) => item.admissionStatus === "pending").length, flagged: items.filter((item) => item.admissionStatus === "fake" || item.isBanned).length }), [admissions.data?.total, items]);

  const columns = useMemo<ColumnDef<AdmissionSummary, any>[]>(() => [
    {
      accessorKey: "applicantName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Applicant" />,
      cell: ({ row }) => (
        <button type="button" onClick={() => navigate({ to: "/g1/admin/admissions/$id", params: { id: row.original.id }, search: true })} className="text-left font-semibold hover:underline text-primary">
          {row.original.applicantName}
        </button>
      ),
    },
    {
      accessorKey: "categoryTypes",
      header: "Categories",
      cell: ({ row }) => {
        const cats = row.original.categoryTypes;
        if (cats.length === 0) return <span className="text-muted-foreground"> - </span>;
        return (
          <div className="flex flex-wrap gap-1">
            {cats.map((cat) => <Badge key={cat} variant="outline">{cat}</Badge>)}
          </div>
        );
      },
    },
    {
      accessorKey: "birthCertificateNumber",
      header: "Birth certificate",
      cell: ({ row }) => <code className="text-xs">{row.original.birthCertificateNumber}</code>,
    },
    {
      accessorKey: "guardianNic",
      header: "Parent NIC",
      cell: ({ row }) => row.original.guardianNic
        ? <code className="text-xs">{row.original.guardianNic}</code>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      accessorKey: "sessionCode",
      header: "Session",
      cell: ({ row }) => <code className="text-xs">{row.original.sessionCode}</code>,
    },
    {
      accessorKey: "admissionStatus",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <StatusBadge status={row.original.admissionStatus} banned={row.original.isBanned} />,
    },
    {
      accessorKey: "submittedAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Submitted" />,
      cell: ({ row }) => <span className="text-muted-foreground whitespace-nowrap">{row.original.submittedAt ? new Date(row.original.submittedAt).toLocaleDateString() : "-"}</span>,
    },
  ], [navigate]);

  if (location.pathname !== "/g1/admin/admissions") {
    return <Outlet />;
  }

  if (settings.isLoading) {
    return <main className="min-h-svh p-6 md:p-10"><Card><CardContent className="flex items-center gap-3 p-8"><ClipboardCheck className="text-primary" size={20} /> Loading admissions window…</CardContent></Card></main>;
  }

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)] p-6 md:p-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Admin / Admissions</p>
          <h1 className="mt-1 font-heading text-[clamp(2rem,4vw,3.6rem)]">Interview admissions</h1>
          <p className="mt-3 max-w-[68ch] text-muted-foreground">Review submitted applications one at a time, confirm each category entry, and record the interview outcome.</p>
        </div>
        {windowClosed && <div className="flex items-center gap-2 text-sm font-semibold text-primary"><span className="size-2 rounded-full bg-current" /> Submission window closed</div>}
      </div>

      <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Submitted applications" value={counts.total} icon={ClipboardCheck} />
            <StatCard label="Pending review" value={counts.pending} icon={FileWarning} />
            <StatCard label="Verified" value={counts.verified} icon={CheckCircle2} />
            <StatCard label="Flagged or banned" value={counts.flagged} icon={ShieldAlert} />
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>All applicants</CardTitle>
                  <CardDescription>Click a name to select a category and open the interview workspace.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {admissions.error && <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"><ShieldAlert size={17} className="mt-0.5 shrink-0" /> Could not load admissions: {admissions.error.message}</div>}
              <DataTable
                columns={columns}
                data={items}
                pageCount={pageCount}
                loading={admissions.isLoading}
                pagination={pagination}
                sorting={sorting}
                columnFilters={columnFilters}
                onPaginationChange={setPagination}
                onSortingChange={setSorting}
                onColumnFiltersChange={setColumnFilters}
                toolbar={(table) => {
                  const filters = table.getState().columnFilters;
                  const isFiltered = filters.length > 0;
                  const setFilter = (id: string, value: string) => {
                    const next = filters.filter((f) => f.id !== id);
                    if (value) next.push({ id, value });
                    table.setColumnFilters(next);
                  };
                  return (
                    <div className="flex items-center justify-between">
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          placeholder="Search applicant, birth certificate, or session…"
                          value={(filters.find((f) => f.id === "query")?.value as string) ?? ""}
                          onChange={(e) => setFilter("query", e.target.value)}
                          className="h-8 w-[200px] lg:w-[250px]"
                        />
                        <Select
                          value={(filters.find((f) => f.id === "status")?.value as string) ?? "all"}
                          onValueChange={(val) => setFilter("status", val ?? "")}
                        >
                          <SelectTrigger className="h-8 w-[180px]">
                            <SelectValue placeholder="All applicants" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isFiltered && (
                          <Button variant="ghost" onClick={() => table.resetColumnFilters()} className="h-8 px-2 lg:px-3">
                            Reset
                          </Button>
                        )}
                      </div>
                      <DataTableViewOptions table={table} />
                    </div>
                  );
                }}
                paginationBar={(table) => <DataTablePagination table={table} />}
              />
            </CardContent>
          </Card>
      </>
    </main>
  );
}
