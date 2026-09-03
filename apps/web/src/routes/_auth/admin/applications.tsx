import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ArrowLeft, Eye, Pencil, ShieldCheck, Trash2, Clock } from "lucide-react";
import { consumeEventIterator } from "@orpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnFiltersState, type PaginationState, type SortingState } from "@tanstack/react-table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aloysius-g1/ui/components/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aloysius-g1/ui/components/card";
import { Button } from "@aloysius-g1/ui/components/button";
import { Badge } from "@aloysius-g1/ui/components/badge";
import { useAdminPreferences } from "@/lib/admin-preferences";
import { Input } from "@aloysius-g1/ui/components/input";
import {
  DataTable,
  DataTableColumnHeader,
  DataTablePagination,
  DataTableViewOptions,
} from "@aloysius-g1/ui/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aloysius-g1/ui/components/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@aloysius-g1/ui/components/select";
import { client, orpc } from "@/utils/orpc";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/admin/applications")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.prefetchQuery(context.orpc.admin.overview.queryOptions()),
      context.queryClient.prefetchQuery(context.orpc.admin.applications.queryOptions({
        input: { page: 1, pageSize: 10, query: "", sort: "updatedAt", sortDir: "desc", status: "all" },
      })),
    ]);
  },
  component: AdminApplicationsPage,
});

type ApplicationRow = {
  id: string
  applicantName: string
  sessionCode: string
  accessKeyHint: string
  status: string
  validationErrors: string[]
  createdAt: Date
  updatedAt: Date
}

function DeleteDialog({ open, onOpenChange, onConfirm, applicantName, isPending }: { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; applicantName: string; isPending: boolean }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete application</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{applicantName}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ActionsMenu({ item, onDeleted }: { item: ApplicationRow; onDeleted: () => void }) {
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMutation = useMutation(orpc.admin.application.remove.mutationOptions({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.admin.applications.key() });
      void queryClient.invalidateQueries({ queryKey: orpc.admin.overview.key() });
      toast.success("Application deleted");
      onDeleted();
      setDeleteOpen(false);
    },
  }));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground outline-hidden hover:bg-accent hover:text-accent-foreground">
          <span className="sr-only">Open menu</span>
          <span className="flex items-center justify-center">⋯</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link to="/admin/applications/$id" params={{ id: item.id }} />}>
            <Eye size={15} /> View
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/admin/applications/$id" params={{ id: item.id }} search={{ mode: "edit" }} />}>
            <Pencil size={15} /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={15} /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deleteMutation.mutate({ id: item.id })}
        applicantName={item.applicantName}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Clock }) {
  return <div className="grid gap-2 rounded-xl border bg-card p-4 shadow-[0_10px_30px_color-mix(in_oklch,var(--foreground)_5%,transparent)]"><Icon className="text-primary" size={19} /><span className="text-xs text-muted-foreground">{label}</span><strong className="font-heading text-3xl">{value.toLocaleString()}</strong></div>;
}

function useColumns(onRefetch: () => void) {
  return useMemo(() => [
    {
      accessorKey: "applicantName",
      header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Applicant" />,
      cell: ({ row }: { row: { original: ApplicationRow } }) => (
        <Link to="/admin/applications/$id" params={{ id: row.original.id }} className="font-semibold text-primary hover:underline">
          {row.original.applicantName}
        </Link>
      ),
    },
    {
      accessorKey: "sessionCode",
      header: "Session",
      cell: ({ row }: { row: { original: ApplicationRow } }) => <code className="text-xs">{row.original.sessionCode}</code>,
    },
    {
      accessorKey: "accessKeyHint",
      header: "Key hint",
      cell: ({ row }: { row: { original: ApplicationRow } }) => <span className="text-muted-foreground text-xs">…{row.original.accessKeyHint}</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }: { row: { original: ApplicationRow } }) => (
        <Badge variant={row.original.status === "submitted" ? "default" : "secondary"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "validationErrors",
      header: "Data quality",
      cell: ({ row }: { row: { original: ApplicationRow } }) => row.original.validationErrors.length > 0
        ? <Badge variant="destructive">{row.original.validationErrors.length} issue{row.original.validationErrors.length === 1 ? "" : "s"}</Badge>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Updated" />,
      cell: ({ row }: { row: { original: ApplicationRow } }) => <span className="text-muted-foreground whitespace-nowrap">{new Date(row.original.updatedAt).toLocaleDateString()}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: { row: { original: ApplicationRow } }) => <ActionsMenu item={row.original} onDeleted={onRefetch} />,
    },
  ], [onRefetch]);
}

function AdminApplicationsPage() {
  const { session } = Route.useRouteContext();
  const location = useLocation();
  const prefs = useAdminPreferences();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>(prefs.applicationsSort ? [prefs.applicationsSort] : []);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(prefs.applicationsStatusFilter !== "all" ? [{ id: "status", value: prefs.applicationsStatusFilter }] : []);

  const sort = sorting[0];
  const query = typeof columnFilters.find((f) => f.id === "query")?.value === "string" ? (columnFilters.find((f) => f.id === "query")!.value as string) : "";
  const statusFilter = typeof columnFilters.find((f) => f.id === "status")?.value === "string" ? (columnFilters.find((f) => f.id === "status")!.value as string) : "all";

  const overview = useQuery(orpc.admin.overview.queryOptions());
  const applications = useQuery(orpc.admin.applications.queryOptions({
    input: {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      query,
      sort: sort?.id ?? "updatedAt",
      sortDir: sort?.desc ? "desc" : "asc",
      status: statusFilter as "all" | "draft" | "submitted" | "invalid",
    },
  }));

  useEffect(() => {
    if (session.data?.user.role !== "admin") return;
    const controller = new AbortController();
    const cancel = consumeEventIterator(client.application.liveCount(undefined, { signal: controller.signal }), {
      onEvent: () => { void applications.refetch(); void overview.refetch(); },
      onError: () => undefined,
    });
    return () => { controller.abort(); cancel(); };
  }, [session.data?.user.role, applications, overview]);

  if (location.pathname !== "/admin/applications") return <Outlet />;
  if (session.data?.user.role !== "admin") return <main className="grid place-items-center min-h-svh p-6"><Card className="w-full max-w-md gap-5 p-8"><CardHeader className="p-0"><CardTitle className="font-heading text-[clamp(1.8rem,4vw,2.5rem)]">Admin access required</CardTitle><CardDescription className="leading-relaxed">Your account does not have permission to view applications.</CardDescription></CardHeader><Button variant="default" className="w-fit" render={<Link to="/dashboard" />}><ArrowLeft size={17} /> Back to dashboard</Button></Card></main>;

  const items = (applications.data?.items ?? []) as ApplicationRow[];
  const pageCount = applications.data ? Math.ceil(applications.data.total / applications.data.pageSize) : 0;
  const columns = useColumns(() => void applications.refetch());

  return (
    <main className="min-h-svh p-6 md:p-10 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
      <div className="flex items-end justify-between gap-8 mb-8">
        <div>
          <p className="text-primary font-bold tracking-widest uppercase text-xs">Workspace / Applications</p>
          <h1 className="font-heading text-[clamp(2rem,4vw,3.6rem)] mt-1 mb-3">Applications</h1>
          <p className="text-muted-foreground">Review, filter, and manage application records in real time.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-primary text-sm font-semibold">
          <span className="w-2 h-2 rounded-full bg-current shadow-[0_0_0_0.2rem_color-mix(in_oklch,currentColor_15%,transparent)]" /> Live via SSE
        </span>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={overview.data?.total ?? 0} icon={ShieldCheck} />
        <StatCard label="Drafts" value={overview.data?.drafts ?? 0} icon={Clock} />
        <StatCard label="Submitted" value={overview.data?.submitted ?? 0} icon={ShieldCheck} />
        <StatCard label="Needs attention" value={overview.data?.incomplete ?? 0} icon={ShieldCheck} />
      </div>
      {prefs.recentlyViewed.length > 0 && (
        <Card className="mb-4">
          <CardContent className="py-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><Clock size={12} /> Recently viewed</p>
            <div className="flex flex-wrap gap-2">
              {prefs.recentlyViewed.map((entry) => (
                <Link key={entry.id} to="/admin/applications/$id" params={{ id: entry.id }} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-accent transition-colors">
                  <span className="font-medium">{entry.name}</span>
                  <span className="text-muted-foreground">{new Date(entry.viewedAt).toLocaleDateString()}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>All applications</CardTitle>
              <CardDescription>Selections and location data are available in the details view.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={items}
            pageCount={pageCount}
            loading={applications.isLoading}
            pagination={pagination}
            sorting={sorting}
            columnFilters={columnFilters}
            onPaginationChange={setPagination}
            onSortingChange={(updater) => {
              const next = typeof updater === "function" ? updater(sorting) : updater;
              setSorting(next);
              prefs.setApplicationsSort(next[0] ?? null);
            }}
            onColumnFiltersChange={(updater) => {
              const next = typeof updater === "function" ? updater(columnFilters) : updater;
              setColumnFilters(next);
              const statusVal = next.find((f) => f.id === "status")?.value;
              prefs.setApplicationsStatusFilter(typeof statusVal === "string" ? statusVal : "all");
            }}
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
                      placeholder="Search applicant or key hint…"
                      value={(filters.find((f) => f.id === "query")?.value as string) ?? ""}
                      onChange={(e) => setFilter("query", e.target.value)}
                      className="h-8 w-[200px] lg:w-[250px]"
                    />
                    <Select
                      value={(filters.find((f) => f.id === "status")?.value as string) ?? "all"}
                      onValueChange={(val) => setFilter("status", val ?? "")}
                    >
                      <SelectTrigger className="h-8 w-[140px]">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="draft">Drafts</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="invalid">Needs attention</SelectItem>
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
    </main>
  );
}
