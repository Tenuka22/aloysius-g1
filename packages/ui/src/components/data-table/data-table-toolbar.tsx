import { type Table } from "@tanstack/react-table"
import { XIcon } from "lucide-react"
import type { RefObject } from "react"
import { Button } from "@aloysius-g1/ui/components/button"
import { Input } from "@aloysius-g1/ui/components/input"
import { DataTableViewOptions } from "./data-table-view-options"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  filterColumn?: string
  filterPlaceholder?: string
  inputRef?: RefObject<HTMLInputElement | null>
}

export function DataTableToolbar<TData>({
  table,
  filterColumn,
  filterPlaceholder = "Filter...",
  inputRef,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center gap-2">
        {filterColumn && (
          <Input
            ref={inputRef}
            placeholder={filterPlaceholder}
            value={(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn(filterColumn)?.setFilterValue(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <XIcon />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  )
}
