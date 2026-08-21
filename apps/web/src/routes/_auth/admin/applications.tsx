import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ArrowLeft, Eye, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { consumeEventIterator } from "@orpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnFiltersState, type PaginationState, type SortingState } from "@tanstack/react-table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aloysius-g1/ui/components/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aloysius-g1/ui/components/card";
import { Button } from "@aloysius-g1/ui/components/button";
import { Badge } from "@aloysius-g1/ui/components/badge";
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

export const Route = createFileRoute("/_auth/admin/applications")({ component: AdminApplicationsPage });

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

  const deleteMutation = useMutation({
    mutationFn: async () => { await client.admin.application.remove({ id: item.id }) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.admin.applications.key() });
      setMessage("Application deleted");
      onDeleted();
      setDeleteOpen(false);
    },
    onError: (error) => { setMessage(error instanceof Error ? error.message : "Could not delete application"); },
  });

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
          <DropdownMenuItem render={<Link to="/admin/applications/$id?mode=edit" params={{ id: item.id }} />}>
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
        onConfirm={() => deleteMutation.mutate()}
        applicantName={item.applicantName}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}

const columns = [
  {
    accessorKey: "applicantName",
    header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Applicant" />,
    cell: ({ row }: { row: { original: ApplicationRow } }) => <span className="font-medium">{row.original.applicantName}</span>,
  },
  {
    accessorKey: "sessionCode",
    header: "Session code",
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
      <Badge variant={row.original.status === "submitted" ? "default" : row.original.status === "draft" ? "secondary" : "outline"}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "validationErrors",
    header: "Data quality",
    cell: ({ row }: { row: { original: ApplicationRow } }) => row.original.validationErrors.length > 0
      ? <Badge variant="destructive">{row.original.validationErrors.length} issue{row.original.validationErrors.length === 1 ? "" : "s"}</Badge>
      : <Badge variant="outline">Clean</Badge>,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Created" />,
    cell: ({ row }: { row: { original: ApplicationRow } }) => <span className="text-muted-foreground whitespace-nowrap">{new Date(row.original.createdAt).toLocaleDateString()}</span>,
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Updated" />,
    cell: ({ row }: { row: { original: ApplicationRow } }) => <span className="text-muted-foreground whitespace-nowrap">{new Date(row.original.updatedAt).toLocaleDateString()}</span>,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }: { row: { original: ApplicationRow } }) => <ActionsMenu item={row.original} onDeleted={() => void applications.refetch()} />,
  },
];

function AdminApplicationsPage() {
  const { session } = Route.useRouteContext();
  const location = useLocation();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const sort = sorting[0];
  const query = typeof columnFilters.find((f) => f.id === "query")?.value === "string" ? (columnFilters.find((f) => f.id === "query")!.value as string) : "";
  const statusFilter = typeof columnFilters.find((f) => f.id === "status")?.value === "string" ? (columnFilters.find((f) => f.id === "status")!.value as string) : "all";

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
      onEvent: () => { void applications.refetch(); },
      onError: () => undefined,
    });
    return () => { controller.abort(); cancel(); };
  }, [session.data?.user.role, applications]);

  if (location.pathname !== "/admin/applications") return <Outlet />;
  if (session.data?.user.role !== "admin") return <main className="grid place-items-center min-h-svh p-6"><Card className="w-full max-w-md gap-5 p-8"><CardHeader className="p-0"><CardTitle className="font-heading text-[clamp(1.8rem,4vw,2.5rem)]">Admin access required</CardTitle><CardDescription className="leading-relaxed">Your account does not have permission to view applications.</CardDescription></CardHeader><Button variant="default" className="w-fit" render={<Link to="/dashboard" />}><ArrowLeft size={17} /> Back to dashboard</Button></Card></main>;

  const items = (applications.data?.items ?? []) as ApplicationRow[];
  const pageCount = applications.data ? Math.ceil(applications.data.total / applications.data.pageSize) : 0;

  const remove = async () => {
    if (!deleteId) return;
    try { await client.admin.application.remove({ id: deleteId }); setDeleteId(null); setMessage("Application deleted"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete application"); }
  };

  return (
    <main className="min-h-svh p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
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
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>All applications</CardTitle>
              <CardDescription>Selections and location data are available in the details view.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {message && <p className="text-primary mb-4" role="status">{message}</p>}
          <DataTable
            columns={columns}
            data={items}
            pageCount={pageCount}
            loading={applications.isLoading}
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
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete application</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. Are you sure?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
