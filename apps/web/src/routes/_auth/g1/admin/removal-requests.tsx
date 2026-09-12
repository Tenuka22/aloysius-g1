import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { ArrowLeft, Trash2, X } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { consumeEventIterator } from "@orpc/client";
import { type ColumnFiltersState, type PaginationState, type SortingState } from "@tanstack/react-table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aloysius-admissions/ui/components/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aloysius-admissions/ui/components/card";
import { Button } from "@aloysius-admissions/ui/components/button";
import { Badge } from "@aloysius-admissions/ui/components/badge";
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
import { intakeYearSearchSchema } from "@/lib/g1/intake-year";

export const Route = createFileRoute("/_auth/g1/admin/removal-requests")({
  validateSearch: intakeYearSearchSchema,
  loaderDeps: ({ search }) => ({ intakeYear: search.intakeYear }),
  loader: async ({ context, deps }) => {
    const { intakeYear } = deps;
    await context.queryClient.prefetchQuery(context.orpc.admin.accessRequests.removalRequests.queryOptions({
      input: { page: 1, pageSize: 10, query: "", intakeYear },
    }));
  },
  component: AdminRemovalRequestsPage,
});

type RemovalRequestRow = {
  id: string
  applicantName: string
  guardianName?: string
  contactEmail: string
  contactPhone?: string | null
  birthCertificateNumber: string
  status: string
  createdAt: Date
}

function ActionsMenu({ item, onAction }: { item: RemovalRequestRow; onAction: () => void }) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => client.admin.accessRequests.deleteAfterRemovalRequest({ requestId: item.id }),
    onSuccess: () => {
      toast.success("Application deleted");
      onAction();
      setDeleteOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete application"),
  });

  const dismissMutation = useMutation({
    mutationFn: () => client.admin.accessRequests.dismiss({ requestId: item.id }),
    onSuccess: () => {
      toast.success("Request dismissed");
      onAction();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not dismiss request"),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground outline-hidden hover:bg-accent hover:text-accent-foreground">
          <span className="sr-only">Open menu</span>
          <span className="flex items-center justify-center">⋯</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={15} /> Delete application
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => dismissMutation.mutate()} disabled={dismissMutation.isPending}>
            <X size={15} /> {dismissMutation.isPending ? "Dismissing…" : "Dismiss request"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={deleteOpen} onOpenChange={(open) => !open && setDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the application for <strong>{item.applicantName}</strong> and resolve the removal request. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AdminRemovalRequestsPage() {
  const { session } = Route.useRouteContext();
  const location = useLocation();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const query = typeof columnFilters.find((f) => f.id === "query")?.value === "string" ? (columnFilters.find((f) => f.id === "query")!.value as string) : "";
  const { intakeYear } = Route.useSearch();

  const requests = useQuery(orpc.admin.accessRequests.removalRequests.queryOptions({
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
    return () => { controller.abort(); void cancel().catch(() => undefined); };
  }, [session.data?.user.role, requests]);

  if (session.data?.user.role !== "admin") return <main className="grid place-items-center min-h-svh p-6"><Card className="w-full max-w-md gap-5 p-8"><CardHeader className="p-0"><CardTitle className="font-heading text-[clamp(1.8rem,4vw,2.5rem)]">Admin access required</CardTitle><CardDescription className="leading-relaxed">Your account does not have permission to view requests.</CardDescription></CardHeader><Button variant="default" className="w-fit" render={<Link to="/admissions" />} nativeButton={false}><ArrowLeft size={17} /> Back to dashboard</Button></Card></main>;

  const items = (requests.data?.items ?? []) as RemovalRequestRow[];
  const pageCount = requests.data ? Math.ceil(requests.data.total / requests.data.pageSize) : 0;
  const refetch = requests.refetch;

  const columns = useMemo(() => [
    {
      accessorKey: "applicantName",
      header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Applicant" />,
      cell: ({ row }: { row: { original: RemovalRequestRow } }) => (
        <div>
          <span className="font-medium">{row.original.applicantName || "Unnamed"}</span>
          {row.original.guardianName && <span className="text-muted-foreground text-xs block">Guardian: {row.original.guardianName}</span>}
        </div>
      ),
    },
    {
      accessorKey: "birthCertificateNumber",
      header: "Birth certificate",
      cell: ({ row }: { row: { original: RemovalRequestRow } }) => <span className="text-xs">{row.original.birthCertificateNumber}</span>,
    },
    {
      accessorKey: "contactPhone",
      header: "Contact",
      cell: ({ row }: { row: { original: RemovalRequestRow } }) => (
        <div className="grid gap-0.5">
          <span>{row.original.contactPhone || "..."}</span>
          <span className="text-muted-foreground text-xs">{row.original.contactEmail}</span>
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Requested" />,
      cell: ({ row }: { row: { original: RemovalRequestRow } }) => <span className="text-muted-foreground whitespace-nowrap">{new Date(row.original.createdAt).toLocaleDateString()}</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }: { row: { original: RemovalRequestRow } }) => {
        const s = row.original.status;
        const color = s === "open" ? "bg-primary/15 text-primary" : s === "resolved" ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-500/15 text-zinc-600";
        return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${color}`}>{s}</span>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: { row: { original: RemovalRequestRow } }) => row.original.status === "open" ? <div className="flex justify-end"><ActionsMenu item={row.original} onAction={() => void refetch()} /></div> : null,
    },
  ], [refetch]);

  return (
    <main className="min-h-svh p-4 sm:p-8 lg:p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
      <div className="flex flex-wrap items-end justify-between gap-4 sm:gap-8 mb-8">
        <div>
          <p className="text-primary font-bold tracking-widest uppercase text-xs">Workspace / Requests</p>
          <h1 className="font-heading text-[clamp(2rem,4vw,3.6rem)] mt-1 mb-3">Removal requests</h1>
          <p className="text-muted-foreground">Applicants requested deletion of duplicate or incorrect records.</p>
        </div>
        <Button variant="secondary" render={<Link to="/g1/admin/applications" search={true} />} nativeButton={false}>Back to applications</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>Applicants requested deletion of duplicate or incorrect records. Active requests require action.</CardDescription>
        </CardHeader>
        <CardContent>
          {message && <p className="text-primary mb-4" role="status">{message}</p>}
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
            rowClassName={(row) => (row as RemovalRequestRow).status !== "open" ? "opacity-40" : undefined}
            toolbar={(table) => {
              const filters = table.getState().columnFilters;
              const isFiltered = filters.length > 0;
              const setFilter = (id: string, value: string) => {
                const next = filters.filter((f) => f.id !== id);
                if (value) next.push({ id, value });
                table.setColumnFilters(next);
              };
              return (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <Input
                      placeholder="Filter by name or email…"
                      value={(filters.find((f) => f.id === "query")?.value as string) ?? ""}
                      onChange={(e) => setFilter("query", e.target.value)}
                      className="h-8 w-full sm:w-50 lg:w-62.5"
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
    </main>
  );
}
