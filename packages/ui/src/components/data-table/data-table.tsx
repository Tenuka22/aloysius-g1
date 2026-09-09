import { Skeleton } from "@aloysius-admissions/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@aloysius-admissions/ui/components/table";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  type Table as TanStackTable,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageCount: number;
  loading?: boolean;
  /**
   * Set when the query backing `data` failed. Without this the table cannot
   * tell "nothing exists" from "we could not find out", and a failed fetch is
   * indistinguishable from an empty queue.
   */
  error?: unknown;
  /** Shown when the query succeeded and returned no rows. */
  emptyState?: React.ReactNode;
  /** Shown when `error` is set. Falls back to a terse built-in message. */
  errorState?: React.ReactNode;
  onPaginationChange?: OnChangeFn<PaginationState>;
  onSortingChange?: OnChangeFn<SortingState>;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  pagination?: PaginationState;
  sorting?: SortingState;
  columnFilters?: ColumnFiltersState;
  toolbar?: (table: TanStackTable<TData>) => React.ReactNode;
  paginationBar?: (table: TanStackTable<TData>) => React.ReactNode;
  rowClassName?: (row: TData) => string | undefined;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
  loading,
  error,
  emptyState,
  errorState,
  onPaginationChange,
  onSortingChange,
  onColumnFiltersChange,
  pagination: externalPagination,
  sorting: externalSorting,
  columnFilters: externalColumnFilters,
  toolbar,
  paginationBar,
  rowClassName,
}: DataTableProps<TData, TValue>) {
  const [internalPagination, setInternalPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([]);
  const [internalColumnFilters, setInternalColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [internalColumnVisibility, setInternalColumnVisibility] = React.useState<VisibilityState>(
    {},
  );
  const [internalRowSelection, setInternalRowSelection] = React.useState({});

  const isControlled = !!externalPagination;
  const pagination = isControlled ? externalPagination : internalPagination;
  // Match the skeleton row count to the page size so the table occupies the
  // same height while loading as it will once the rows arrive.
  const skeletonRowCount = Math.min(pagination.pageSize || 10, 10);
  const skeletonRows = React.useMemo(
    () =>
      Array.from({ length: skeletonRowCount }, (_, rowIndex) =>
        columns.map((column, columnIndex) => `skeleton-${rowIndex}-${column.id ?? columnIndex}`),
      ),
    [skeletonRowCount, columns],
  );
  const sorting = externalSorting ?? internalSorting;
  const columnFilters = externalColumnFilters ?? internalColumnFilters;

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      pagination,
      sorting,
      columnFilters,
      columnVisibility: internalColumnVisibility,
      rowSelection: internalRowSelection,
    },
    onPaginationChange: isControlled ? onPaginationChange : setInternalPagination,
    onSortingChange: onSortingChange ?? setInternalSorting,
    onColumnFiltersChange: onColumnFiltersChange ?? setInternalColumnFilters,
    onColumnVisibilityChange: setInternalColumnVisibility,
    onRowSelectionChange: setInternalRowSelection,
    manualPagination: true,
    manualSorting: !!onSortingChange,
    manualFiltering: !!onColumnFiltersChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <div className="space-y-4">
      {toolbar?.(table)}
      <div className="size-full flex">
        <div className="overflow-x-auto rounded-md border grow flex-1 w-0">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                // Skeleton rows rather than a single "Loading" cell: the table
                // keeps its height, so landing rows do not shift the page.
                skeletonRows.map((cellKeys) => (
                  <TableRow key={cellKeys[0]}>
                    {cellKeys.map((cellKey) => (
                      <TableCell key={cellKey}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    {errorState ?? "Could not load this list."}
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={rowClassName?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    {emptyState ?? "No results."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      {paginationBar?.(table)}
    </div>
  );
}
