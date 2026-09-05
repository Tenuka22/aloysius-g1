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
import { FORM_WINDOW_WARNING } from "@/lib/color-classes";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/sub-admin/removal-requests")({ component: SubAdminRemovalRequestsPage });

type RemovalRequestRow = {
  id: string;
  applicantName: string;
  birthCertificateNumber: string;
  status: string;
  createdAt: Date;
};

function ActionsMenu({ item, onAction, isOpen }: { item: RemovalRequestRow; onAction: () => void; isOpen: boolean }) {
  const { t } = useTranslation();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const approve = async () => {
    try {
      await client.subAdmin.deleteAfterRemovalRequest({ requestId: item.id });
      toast.success(t("subAdminRemoval.toast.deleted"));
      onAction();
      setDeleteOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("subAdminRemoval.toast.deleteError"));
    }
  };
  const dismiss = async () => {
    try {
      await client.subAdmin.dismiss({ requestId: item.id });
      toast.success(t("subAdminRemoval.toast.dismissed"));
      onAction();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("subAdminRemoval.toast.dismissError"));
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
            <Trash2 size={15} /> {t("subAdminRemoval.actions.deleteApplication")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={dismiss}>
            <X size={15} /> {t("subAdminRemoval.actions.dismiss")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={deleteOpen} onOpenChange={(open) => !open && setDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("subAdminRemoval.confirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("subAdminRemoval.confirm.description", { name: item.applicantName, number: item.birthCertificateNumber })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteOpen(false)}>{t("subAdminRemoval.confirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={approve} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("subAdminRemoval.confirm.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SubAdminRemovalRequestsPage() {
  const { t } = useTranslation();
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
  if (role !== "admin" && role !== "sub-admin") return <main className="grid place-items-center min-h-svh p-6"><Card className="w-full max-w-md gap-5 p-8"><CardHeader className="p-0"><CardTitle className="font-heading text-[clamp(1.8rem,4vw,2.5rem)]">{t("subAdminRemoval.noAccess.title")}</CardTitle></CardHeader><Button variant="default" className="w-fit" render={<Link to="/" />}><ArrowLeft size={17} /> {t("subAdminRemoval.noAccess.backToDashboard")}</Button></Card></main>;

  const isOpen = !statusQuery.data?.submissionLocked;
  const items = (requests.data?.items ?? []) as RemovalRequestRow[];
  const pageCount = requests.data ? Math.ceil(requests.data.total / requests.data.pageSize) : 0;

  return (
    <main className="min-h-svh p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
      <div className="flex items-end justify-between gap-8 mb-8">
        <div>
          <p className="text-primary font-bold tracking-widest uppercase text-xs">{t("subAdminRemoval.breadcrumb")}</p>
          <h1 className="font-heading text-[clamp(2rem,4vw,3.6rem)] mt-1 mb-3">{t("subAdminRemoval.title")}</h1>
          <p className="text-muted-foreground">{t("subAdminRemoval.description")}</p>
        </div>
        <Button variant="secondary" render={<Link to="/sub-admin" />}>{t("subAdminRemoval.backToOverview")}</Button>
      </div>
      {!isOpen && (
        <Card className={`mb-4 ${FORM_WINDOW_WARNING.card}`}>
          <CardContent className="flex items-center gap-3 py-3">
            <span className={`${FORM_WINDOW_WARNING.text} font-semibold text-sm`}>{t("subAdminRemoval.windowClosed.title")}</span>
            <span className="text-muted-foreground text-sm">{t("subAdminRemoval.windowClosed.description")}</span>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("subAdminRemoval.pending.title")}</CardTitle>
          <CardDescription>{t("subAdminRemoval.pending.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                accessorKey: "birthCertificateNumber",
                header: ({ column }) => <DataTableColumnHeader column={column} title={t("subAdminRemoval.column.birthCert")} />,
                cell: ({ row }) => <span className="font-mono text-sm">{row.original.birthCertificateNumber}</span>,
              },
              {
                accessorKey: "createdAt",
                header: ({ column }) => <DataTableColumnHeader column={column} title={t("subAdminRemoval.column.requested")} />,
                cell: ({ row }) => <span className="text-muted-foreground whitespace-nowrap">{new Date(row.original.createdAt).toLocaleDateString()}</span>,
              },
              {
                id: "actions",
                header: t("subAdminRemoval.column.actions"),
                cell: ({ row }) => <div className="flex justify-end"><ActionsMenu item={row.original} onAction={() => void requests.refetch()} isOpen={isOpen} /></div>,
              },
            ]}
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
                      placeholder={t("subAdminRemoval.filterPlaceholder")}
                      value={(filters.find((f) => f.id === "query")?.value as string) ?? ""}
                      onChange={(e) => setFilter("query", e.target.value)}
                      className="h-8 w-[200px] lg:w-[250px]"
                    />
                    {isFiltered && (
                      <Button variant="ghost" onClick={() => table.resetColumnFilters()} className="h-8 px-2 lg:px-3">
                        {t("subAdminRemoval.reset")}
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
