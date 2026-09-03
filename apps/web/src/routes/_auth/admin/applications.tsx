import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clock, FileWarning, AlertTriangle, Eye, Pencil, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { consumeEventIterator } from "@orpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnFiltersState, type PaginationState, type SortingState } from "@tanstack/react-table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aloysius-g1/ui/components/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aloysius-g1/ui/components/card";
import { Button } from "@aloysius-g1/ui/components/button";
import { Badge } from "@aloysius-g1/ui/components/badge";
import { Skeleton } from "@aloysius-g1/ui/components/skeleton";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@aloysius-g1/ui/components/tooltip";
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

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ComponentType<{ size?: number }>; color: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-[0_2px_8px_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
      <div className={`grid size-10 place-items-center rounded-lg ${color}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border bg-card p-4">
          <Skeleton className="size-10 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="mb-1 h-3 w-16" />
            <Skeleton className="h-7 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
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

function StatusBadge({ status }: { status: string }) {
  const config = {
    submitted: { variant: "default" as const, icon: CheckCircle2, label: "Submitted" },
    draft: { variant: "secondary" as const, icon: Clock, label: "Draft" },
  }[status] ?? { variant: "outline" as const, icon: FileWarning, label: status };

  return (
    <Badge variant={config.variant} className="gap-1">
      <config.icon size={12} />
      {config.label}
    </Badge>
  );
}

function useColumns(onRefetch: () => void) {
  return useMemo(() => [
    {
      accessorKey: "applicantName",
      header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Applicant" />,
      cell: ({ row }: { row: { original: ApplicationRow } }) => (
        <Link to="/admin/applications/$id" params={{ id: row.original.id }} className="font-semibold text-foreground hover:underline">
          {row.original.applicantName}
        </Link>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }: { row: { original: ApplicationRow } }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "sessionCode",
      header: "Session",
      cell: ({ row }: { row: { original: ApplicationRow } }) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{row.original.sessionCode}</code>
      ),
    },
    {
      accessorKey: "validationErrors",
      header: "Data quality",
      cell: ({ row }: { row: { original: ApplicationRow } }) => {
        const count = row.original.validationErrors.length;
        if (count === 0) {
          return <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50"><CheckCircle2 size={12} /> Clean</Badge>;
        }
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={<Badge variant="destructive" className="gap-1 cursor-help" />}>
                <AlertTriangle size={12} /> {count} issue{count === 1 ? "" : "s"}
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <div className="flex flex-col gap-1">
                  {row.original.validationErrors.map((error) => (
                    <span key={error} className="text-xs">{error.replace(/_/g, " ")}</span>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Last updated" />,
      cell: ({ row }: { row: { original: ApplicationRow } }) => {
        const date = new Date(row.original.updatedAt);
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={<span className="cursor-default text-muted-foreground text-sm">{relativeTime(date)}</span>}>
                {date.toLocaleString()}
              </TooltipTrigger>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      id: "actions",
      header: "",
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
  const total = overview.data?.total ?? 0;
  const drafts = overview.data?.drafts ?? 0;
  const submitted = overview.data?.submitted ?? 0;
  const invalid = overview.data?.incomplete ?? 0;
  const columns = useColumns(() => void applications.refetch());

  return (
    <main className="min-h-svh p-6 md:p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
      <div className="flex items-end justify-between gap-8 mb-6">
        <div>
          <p className="text-primary font-bold tracking-widest uppercase text-xs">Workspace / Applications</p>
          <h1 className="font-heading text-[clamp(2rem,4vw,3.6rem)] mt-1 mb-2">Applications</h1>
          <p className="text-muted-foreground">Review, filter, and manage application records in real time.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-primary text-sm font-semibold">
          <span className="w-2 h-2 rounded-full bg-current shadow-[0_0_0_0.2rem_color-mix(in_oklch,currentColor_15%,transparent)]" /> Live via SSE
        </span>
      </div>

      {overview.isLoading ? (
        <StatCardsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          <StatCard label="Total" value={total} icon={Users} color="bg-primary/10 text-primary" />
          <StatCard label="Drafts" value={drafts} icon={FileWarning} color="bg-amber-500/10 text-amber-600" />
          <StatCard label="Submitted" value={submitted} icon={CheckCircle2} color="bg-green-500/10 text-green-600" />
          <StatCard label="Needs attention" value={invalid} icon={AlertTriangle} color="bg-red-500/10 text-red-600" />
        </div>
      )}

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
              <CardDescription>
                {applications.data ? `${applications.data.total} total · showing ${items.length} on this page` : "Loading applications…"}
              </CardDescription>
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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-1 items-center gap-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search applicant, session…"
                        value={(filters.find((f) => f.id === "query")?.value as string) ?? ""}
                        onChange={(e) => setFilter("query", e.target.value)}
                        className="h-8 w-[200px] pl-8 lg:w-[260px]"
                      />
                    </div>
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
