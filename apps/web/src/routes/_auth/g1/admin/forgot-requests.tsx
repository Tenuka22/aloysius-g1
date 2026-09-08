import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, QrCode, X } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { consumeEventIterator } from "@orpc/client";
import { type ColumnFiltersState, type PaginationState, type SortingState } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aloysius-admissions/ui/components/card";
import { Button } from "@aloysius-admissions/ui/components/button";
import { Input } from "@aloysius-admissions/ui/components/input";
import {
  DataTable,
  DataTableColumnHeader,
  DataTablePagination,
  DataTableViewOptions,
} from "@aloysius-admissions/ui/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aloysius-admissions/ui/components/dropdown-menu";
import { client, orpc } from "@/utils/orpc";
import { toast } from "sonner";
import { AccessKeyQrDialog } from "@/components/g1/application/access-key-qr";
import { formatPhoneDisplay } from "@/lib/phone";
import { intakeYearSearchSchema } from "@/lib/g1/intake-year";

export const Route = createFileRoute("/_auth/g1/admin/forgot-requests")({
  validateSearch: intakeYearSearchSchema,
  loaderDeps: ({ search }) => ({ intakeYear: search.intakeYear }),
  loader: async ({ context, deps }) => {
    const { intakeYear } = deps;
    await context.queryClient.prefetchQuery(context.orpc.admin.accessRequests.forgotRequests.queryOptions({
      input: { page: 1, pageSize: 10, query: "", intakeYear },
    }));
  },
  component: AdminForgotRequestsPage,
});

type ForgotRequestRow = {
  id: string;
  applicantName: string;
  birthCertificateNumber: string;
  contactPhone?: string | null;
  status: string;
  createdAt: Date;
};

function ActionsMenu({ item, onKeyGenerated, onDismissed }: { item: ForgotRequestRow; onKeyGenerated: (key: string) => void; onDismissed: () => void }) {
  const rotateMutation = useMutation({
    mutationFn: () => client.admin.accessRequests.rotateKey({ requestId: item.id }),
    onSuccess: (result) => {
      onKeyGenerated(result.accessKey);
      toast.success("New key generated");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not generate key"),
  });

  const dismissMutation = useMutation({
    mutationFn: () => client.admin.accessRequests.dismiss({ requestId: item.id }),
    onSuccess: () => {
      toast.success("Request dismissed");
      onDismissed();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not dismiss request"),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground outline-hidden hover:bg-accent hover:text-accent-foreground">
        <span className="flex items-center justify-center">⋯</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => rotateMutation.mutate()} disabled={rotateMutation.isPending}>
          <KeyRound size={15} /> {rotateMutation.isPending ? "Generating…" : "Generate new key"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => dismissMutation.mutate()} disabled={dismissMutation.isPending}>
          <X size={15} /> {dismissMutation.isPending ? "Dismissing…" : "Dismiss"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdminForgotRequestsPage() {
  const { session } = Route.useRouteContext();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [generatedKey, setGeneratedKey] = useState("");
  const [qrKey, setQrKey] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const query = typeof columnFilters.find((f) => f.id === "query")?.value === "string" ? (columnFilters.find((f) => f.id === "query")!.value as string) : "";
  const { intakeYear } = Route.useSearch();

  const requests = useQuery(orpc.admin.accessRequests.forgotRequests.queryOptions({
    input: {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      query,
      status: statusFilter as "open" | "resolved" | "dismissed" | "all",
      intakeYear,
    },
  }));

  useEffect(() => {
    if (session.data?.user.role !== "admin") return;
    const controller = new AbortController();
    const cancel = consumeEventIterator(client.application.liveCount(undefined, { signal: controller.signal }), {
      onEvent: () => { void requests.refetch(); },
      onError: () => undefined,
    });
    return () => { controller.abort(); cancel(); };
  }, [session.data?.user.role, requests]);

  if (session.data?.user.role !== "admin") return <main className="grid place-items-center min-h-svh p-6"><Card className="w-full max-w-md gap-5 p-8"><CardHeader className="p-0"><CardTitle className="font-heading text-[clamp(1.8rem,4vw,2.5rem)]">Admin access required</CardTitle><CardDescription className="leading-relaxed">Your account does not have permission to view requests.</CardDescription></CardHeader><Button variant="default" className="w-fit" render={<Link to="/" />} nativeButton={false}><ArrowLeft size={17} /> Back to dashboard</Button></Card></main>;

  const items = (requests.data?.items ?? []) as ForgotRequestRow[];
  const pageCount = requests.data ? Math.ceil(requests.data.total / requests.data.pageSize) : 0;

  const refetch = requests.refetch;
  const columns = useMemo(() => [
    {
      accessorKey: "applicantName",
      header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Applicant" />,
      cell: ({ row }: { row: { original: ForgotRequestRow } }) => <span className="font-medium">{row.original.applicantName || "Unnamed"}</span>,
    },
    {
      accessorKey: "birthCertificateNumber",
      header: "Birth certificate",
      cell: ({ row }: { row: { original: ForgotRequestRow } }) => <span className="text-xs">{row.original.birthCertificateNumber}</span>,
    },
    {
      accessorKey: "contactPhone",
      header: "Phone",
      cell: ({ row }: { row: { original: ForgotRequestRow } }) => <span className="text-xs">{row.original.contactPhone ? formatPhoneDisplay(row.original.contactPhone) : "-"}</span>,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Requested" />,
      cell: ({ row }: { row: { original: ForgotRequestRow } }) => <span className="text-muted-foreground whitespace-nowrap">{new Date(row.original.createdAt).toLocaleDateString()}</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }: { row: { original: ForgotRequestRow } }) => {
        const s = row.original.status;
        const color = s === "open" ? "bg-primary/15 text-primary" : s === "resolved" ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-500/15 text-zinc-600";
        return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${color}`}>{s}</span>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: { row: { original: ForgotRequestRow } }) => row.original.status === "open" ? <div className="flex justify-end"><ActionsMenu item={row.original} onKeyGenerated={(key) => { setGeneratedKey(key); setQrKey(key); }} onDismissed={() => void refetch()} /></div> : null,
    },
  ], [refetch]);

  return (
    <main className="min-h-svh p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
      <div className="flex items-end justify-between gap-8 mb-8">
        <div>
          <p className="text-primary font-bold tracking-widest uppercase text-xs">Workspace / Requests</p>
          <h1 className="font-heading text-[clamp(2rem,4vw,3.6rem)] mt-1 mb-3">Forgot key requests</h1>
          <p className="text-muted-foreground">Parents who lost their access key request a replacement.</p>
        </div>
        <Button variant="secondary" render={<Link to="/g1/admin/applications" search={true} />} nativeButton={false}>Back to applications</Button>
      </div>
      {generatedKey && (
        <div className="grid gap-1 p-4 mb-4 border rounded-[10px] border-primary/35 bg-primary/7">
          <div className="flex items-center justify-between">
            <strong className="font-semibold text-sm">One-time display</strong>
            <Button variant="ghost" size="icon" onClick={() => { setGeneratedKey(""); void refetch(); }}><X size={16} /></Button>
          </div>
          <code className="text-[1.1rem] font-bold break-all">{generatedKey}</code>
          <span className="text-muted-foreground text-xs">Copy this key now; it will not be shown again.</span>
          <Button variant="secondary" type="button" onClick={() => setQrKey(generatedKey)}><QrCode size={16} /> Show QR code</Button>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>Parents who lost their access key request a replacement. Active requests require action.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={items}
            pageCount={pageCount}
            loading={requests.isLoading}
            pagination={pagination}
            sorting={sorting}
            columnFilters={columnFilters}
            onPaginationChange={setPagination}
            onSortingChange={setSorting}
            onColumnFiltersChange={setColumnFilters}
            rowClassName={(row) => (row as ForgotRequestRow).status !== "open" ? "opacity-40" : undefined}
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
                      placeholder="Filter by name, phone, or birth certificate…"
                      value={(filters.find((f) => f.id === "query")?.value as string) ?? ""}
                      onChange={(e) => setFilter("query", e.target.value)}
                      className="h-8 w-[200px] lg:w-[250px]"
                    />
                    <div className="flex items-center gap-1 rounded-lg border p-0.5">
                      {(["all", "open", "resolved", "dismissed"] as const).map((s) => (
                        <button key={s} onClick={() => { setStatusFilter(s); setPagination((p) => ({ ...p, pageIndex: 0 })); }} className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{s}</button>
                      ))}
                    </div>
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
      <AccessKeyQrDialog accessKey={qrKey} open={Boolean(qrKey)} onOpenChange={(open) => { if (!open) { setQrKey(""); void refetch(); } }} />
    </main>
  );
}
