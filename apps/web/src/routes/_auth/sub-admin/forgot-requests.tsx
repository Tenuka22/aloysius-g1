import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, QrCode, X } from "lucide-react";
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
import { AccessKeyQrDialog } from "@/components/application/access-key-qr";

export const Route = createFileRoute("/_auth/sub-admin/forgot-requests")({ component: SubAdminForgotRequestsPage });

type ForgotRequestRow = {
  id: string;
  applicantName: string;
  birthCertificateNumber: string;
  status: string;
  createdAt: Date;
};

function ActionsMenu({ item, onAction }: { item: ForgotRequestRow; onAction: () => void }) {
  const [generatedKey, setGeneratedKey] = useState("");
  const [qrKey, setQrKey] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const rotate = async () => {
    try {
      const result = await client.subAdmin.rotateKey({ requestId: item.id });
      setGeneratedKey(result.accessKey);
      setQrKey(result.accessKey);
      toast.success("New key generated — show the QR to the parent");
      onAction();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate key");
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
          <DropdownMenuItem onClick={() => setConfirmOpen(true)}>
            <KeyRound size={15} /> Generate new key
          </DropdownMenuItem>
          <DropdownMenuItem onClick={dismiss}>
            <X size={15} /> Dismiss
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate new access key?</AlertDialogTitle>
            <AlertDialogDescription>
              A new access key will be generated for birth certificate <strong>{item.birthCertificateNumber}</strong>. Show the QR code to the parent so they can scan it and access the application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={rotate}>Generate key</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {generatedKey && (
        <div className="grid gap-2 p-4 border rounded-[10px] border-primary/35 bg-primary/7 mt-2">
          <strong className="font-semibold text-sm">One-time display — show QR to parent</strong>
          <code className="text-[1.1rem] font-bold break-all">{generatedKey}</code>
          <Button variant="secondary" type="button" onClick={() => setQrKey(generatedKey)}><QrCode size={16} /> Show QR code</Button>
        </div>
      )}
      <AccessKeyQrDialog accessKey={qrKey} open={Boolean(qrKey)} onOpenChange={(open) => { if (!open) setQrKey(""); }} />
    </>
  );
}

const columns = [
  {
    accessorKey: "birthCertificateNumber",
    header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Birth certificate #" />,
    cell: ({ row }: { row: { original: ForgotRequestRow } }) => <span className="font-mono text-sm">{row.original.birthCertificateNumber}</span>,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }: { column: { getCanSort: () => boolean; toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => <DataTableColumnHeader column={column} title="Requested" />,
    cell: ({ row }: { row: { original: ForgotRequestRow } }) => <span className="text-muted-foreground whitespace-nowrap">{new Date(row.original.createdAt).toLocaleDateString()}</span>,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }: { row: { original: ForgotRequestRow } }) => <div className="flex justify-end"><ActionsMenu item={row.original} onAction={() => void requests.refetch()} /></div>,
  },
];

function SubAdminForgotRequestsPage() {
  const { session } = Route.useRouteContext();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const query = typeof columnFilters.find((f) => f.id === "query")?.value === "string" ? (columnFilters.find((f) => f.id === "query")!.value as string) : "";

  const requests = useQuery(orpc.subAdmin.forgotRequests.queryOptions({
    input: {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      query,
      sort: sorting[0]?.id ?? "createdAt",
      sortDir: sorting[0]?.desc ? "desc" : "asc",
    },
  }));

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

  const items = (requests.data?.items ?? []) as ForgotRequestRow[];
  const pageCount = requests.data ? Math.ceil(requests.data.total / requests.data.pageSize) : 0;

  return (
    <main className="min-h-svh p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
      <div className="flex items-end justify-between gap-8 mb-8">
        <div>
          <p className="text-primary font-bold tracking-widest uppercase text-xs">Sub-admin / Requests</p>
          <h1 className="font-heading text-[clamp(2rem,4vw,3.6rem)] mt-1 mb-3">Forgot key requests</h1>
          <p className="text-muted-foreground">Verify the parent's identity, then generate a new access key or QR code.</p>
        </div>
        <Button variant="secondary" render={<Link to="/sub-admin" />}>Back to overview</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pending forgot key requests</CardTitle>
          <CardDescription>Only verification numbers are shown. Generate a new key after verifying the parent.</CardDescription>
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
