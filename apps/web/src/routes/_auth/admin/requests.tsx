import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { ArrowLeft, Check, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aloysius-g1/ui/components/dropdown-menu";
import { client, orpc } from "@/utils/orpc";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/admin/requests")({ component: AdminRequestsPage });

type RequestRow = {
  id: string
  applicantName: string
  guardianName?: string
  contactEmail: string
  contactPhone?: string | null
  birthCertificateNumber: string
  requestType: string
  createdAt: Date
}

function ActionsMenu({ item, onAction }: { item: RequestRow; onAction: () => void }) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const approveMutation = useQueryClient().getQueryCache().config.defaultOptions?.queries;
  // Use inline mutations via client
  const approve = async () => {
    try {
      await client.admin.accessRequests.approveSubmission({ requestId: item.id });
      toast.success("Submission approved");
      onAction();
      setApproveOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not approve");
    }
  };
  const reject = async () => {
    try {
      await client.admin.accessRequests.rejectSubmission({ requestId: item.id });
      toast.success("Request rejected");
      onAction();
      setRejectOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reject");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground outline-hidden hover:bg-accent hover:text-accent-foreground">
          <span className="sr-only">Open menu</span>
          <span className="flex items-center justify-center">⋯</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setApproveOpen(true)}>
            <Check size={15} /> Approve
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setRejectOpen(true)}>
            <X size={15} /> Reject
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={approveOpen} onOpenChange={(open) => !open && setApproveOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve submission request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the application as submitted. The applicant will be notified and the application will be locked for future edits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setApproveOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={approve}>Approve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={rejectOpen} onOpenChange={(open) => !open && setRejectOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject submission request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will dismiss the request. The applicant will not be able to submit through this request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={reject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const columns = [
  {
    accessorKey: "applicantName",
    header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Applicant" />,
    cell: ({ row }: { row: { original: RequestRow } }) => (
      <div>
        <span className="font-medium">{row.original.applicantName || "Unnamed"}</span>
        {row.original.guardianName && <span className="text-muted-foreground text-xs block">Guardian: {row.original.guardianName}</span>}
      </div>
    ),
  },
  {
    accessorKey: "birthCertificateNumber",
    header: "Birth certificate",
    cell: ({ row }: { row: { original: RequestRow } }) => <span className="text-xs">{row.original.birthCertificateNumber}</span>,
  },
  {
    accessorKey: "contactPhone",
    header: "Contact",
    cell: ({ row }: { row: { original: RequestRow } }) => (
      <div className="grid gap-0.5">
        <span>{row.original.contactPhone || "—"}</span>
        <span className="text-muted-foreground text-xs">{row.original.contactEmail}</span>
      </div>
    ),
  },
  {
    accessorKey: "createdAt",
    header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Requested" />,
    cell: ({ row }: { row: { original: RequestRow } }) => <span className="text-muted-foreground whitespace-nowrap">{new Date(row.original.createdAt).toLocaleDateString()}</span>,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }: { row: { original: RequestRow } }) => <div className="flex justify-end"><ActionsMenu item={row.original} onAction={() => void requests.refetch()} /></div>,
  },
];

function AdminRequestsPage() {
  const { session } = Route.useRouteContext();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [message, setMessage] = useState("");

  const query = typeof columnFilters.find((f) => f.id === "query")?.value === "string" ? (columnFilters.find((f) => f.id === "query")!.value as string) : "";

  const requests = useQuery(orpc.admin.accessRequests.submissionRequests.queryOptions({
    input: {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      query,
      sort: sorting[0]?.id ?? "createdAt",
      sortDir: sorting[0]?.desc ? "desc" : "asc",
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

  if (session.data?.user.role !== "admin") return <main className="grid place-items-center min-h-svh p-6"><Card className="w-full max-w-md gap-5 p-8"><CardHeader className="p-0"><CardTitle className="font-heading text-[clamp(1.8rem,4vw,2.5rem)]">Admin access required</CardTitle><CardDescription className="leading-relaxed">Your account does not have permission to view requests.</CardDescription></CardHeader><Button variant="default" className="w-fit" render={<Link to="/dashboard" />}><ArrowLeft size={17} /> Back to dashboard</Button></Card></main>;

  const items = (requests.data?.items ?? []) as RequestRow[];
  const pageCount = requests.data ? Math.ceil(requests.data.total / requests.data.pageSize) : 0;

  return (
    <main className="min-h-svh p-12.5 max-w-[1240px] mx-auto bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
      <div className="flex items-end justify-between gap-8 mb-8">
        <div>
          <p className="text-primary font-bold tracking-widest uppercase text-xs">Workspace / Requests</p>
          <h1 className="font-heading text-[clamp(2rem,4vw,3.6rem)] mt-1 mb-3">Submission requests</h1>
          <p className="text-muted-foreground">Review and act on late submission requests from applicants.</p>
        </div>
        <Button variant="secondary" render={<Link to="/admin/applications" />}>Back to applications</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pending requests</CardTitle>
          <CardDescription>These applicants requested approval after the submission window closed.</CardDescription>
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
                      placeholder="Filter by name or email…"
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
