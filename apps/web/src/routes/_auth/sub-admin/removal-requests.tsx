import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Trash2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { consumeEventIterator } from "@orpc/client";
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
  DropdownMenuTrigger,
} from "@aloysius-g1/ui/components/dropdown-menu";
import { client, orpc } from "@/utils/orpc";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/sub-admin/removal-requests")({ component: SubAdminRemovalRequestsPage });

type RemovalRequestRow = {
  id: string;
  applicantName: string;
  birthCertificateNumber: string;
  status: string;
  createdAt: Date;
};

function ActionsMenu({ item, onAction, isOpen }: { item: RemovalRequestRow; onAction: () => void; isOpen: boolean }) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  const approve = async () => {
    try {
      await client.subAdmin.deleteAfterRemovalRequest({ requestId: item.id });
      toast.success("Application deleted");
      onAction();
      setDeleteOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete application");
    }
  };
  const dismiss = async () => {
    try {
      await client.subAdmin.dismiss({ requestId: item.id });
      toast.success("Request dismissed");
      onAction();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not dismiss request");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground outline-hidden hover:bg-accent hover:text-accent-foreground">
          <span className="flex items-center justify-center">⋯</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)} disabled={!isOpen}>
            <Trash2 size={15} /> Delete application
          </DropdownMenuItem>
          <DropdownMenuItem onClick={dismiss}>
            <X size={15} /> Dismiss
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={deleteOpen} onOpenChange={(open) => !open && setDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the application for <strong>{item.applicantName}</strong> (birth certificate: {item.birthCertificateNumber}). This action cannot be undone. Only proceed after verifying the parent's identity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={approve} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const columns = [
  {
    accessorKey: "birthCertificateNumber",
    header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Birth certificate #" />,
    cell: ({ row }: { row: { original: RemovalRequestRow } }) => <span className="font-mono text-sm">{row.original.birthCertificateNumber}</span>,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Requested" />,
    cell: ({ row }: { row: { original: RemovalRequestRow } }) => <span className="text-muted-foreground whitespace-nowrap">{new Date(row.original.createdAt).toLocaleDateString()}</span>,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }: { row: { original: RemovalRequestRow } }) => <div className="flex justify-end"><ActionsMenu item={row.original} onAction={() => void requests.refetch()} isOpen={true} /></div>,
  },
];

function SubAdminRemovalRequestsPage() {
  const { session } = Route.useRouteContext();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const query = typeof columnFilters.find((f) => f.id === "query")?.value === "string" ? (columnFilters.find((f) => f.id === "query")!.value as string) : "";

  const requests = useQuery(orpc.subAdmin.removalRequests.queryOptions({
    input: {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      query,
      sort: sorting[0]?.id ?? "createdAt",
      sortDir: sorting[0]?.desc ? "desc" : "asc",
    },
  }));

  const statusQuery = useQuery(orpc.application.status.queryOptions());

  useEffect(() => {
    if (session.data?.user.role !== "admin" && session.data?.user.role !== "sub-admin") return;
    const controller = new AbortController();
    const cancel = consumeEventIterator(client.application.liveCount(undefined, { signal: controller.signal }), {
      onEvent: () => { void requests.refetch(); },
      onError: () => undefined,
    });
    return () => { controller.abort(); cancel(); };
  }, [session.data?.user.role, requests]);

  const role = session.data?.user.role;
  if (role !== "admin" && role !== "sub-admin") return <main className="grid place-items-center min-h-svh p-6"><Card className="w-full max-w-md gap-5 p-8"><CardHeader className="p-0"><CardTitle className="font-heading text-[clamp(1.8rem,4vw,2.5rem)]">Access required</CardTitle></CardHeader><Button variant="default" className="w-fit" render={<Link to="/dashboard" />}><ArrowLeft size={17} /> Back to dashboard</Button></Card></main>;

  const isOpen = !statusQuery.data?.submissionLocked;
  const items = (requests.data?.items ?? []) as RemovalRequestRow[];
  const pageCount = requests.data ? Math.ceil(requests.data.total / requests.data.pageSize) : 0;

  return (
    <main className="min-h-svh p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
      <div className="flex items-end justify-between gap-8 mb-8">
        <div>
          <p className="text-primary font-bold tracking-widest uppercase text-xs">Sub-admin / Requests</p>
          <h1 className="font-heading text-[clamp(2rem,4vw,3.6rem)] mt-1 mb-3">Removal requests</h1>
          <p className="text-muted-foreground">Review and process application deletion requests.</p>
        </div>
        <Button variant="secondary" render={<Link to="/sub-admin" />}>Back to overview</Button>
      </div>
      {!isOpen && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 py-3">
            <span className="text-amber-600 font-semibold text-sm">⚠ Application window is closed</span>
            <span className="text-muted-foreground text-sm">Removal requests can only be processed during the application open period. Deletion is disabled until the window reopens.</span>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Pending removal requests</CardTitle>
          <CardDescription>Only verification numbers are shown. Deletion is only available during the application open period.</CardDescription>
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
                      placeholder="Filter by birth certificate…"
                      value={(filters.find((f) => f.id === "query")?.value as string) ?? ""}
                      onChange={(e) => setFilter("query", e.target.value)}
                      className="h-8 w-[200px] lg:w-[250px]"
                    />
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
