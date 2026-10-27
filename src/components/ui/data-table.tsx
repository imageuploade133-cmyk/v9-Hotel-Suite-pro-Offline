

"use client"

import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
  getExpandedRowModel,
  ExpandedState,
} from "@tanstack/react-table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "./button"
import { Input } from "./input"
import { Search, SearchX } from "lucide-react"
import { EmptyState } from "./empty-state"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  filterColumn?: string
  filterPlaceholder?: string
  isPaginated?: boolean
  children?: (table: ReturnType<typeof useReactTable<TData>>) => React.ReactNode
  tableId: string
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: (visibility: VisibilityState) => void
  rowSelection?: RowSelectionState
  onRowSelectionChange?: React.Dispatch<React.SetStateAction<RowSelectionState>>
  emptyStateTitle?: string
  emptyStateDescription?: string
  emptyStateIcon?: React.ElementType
  renderSubComponent?: (props: { row: any }) => React.ReactElement;
  getSubRows?: (row: any) => any[];
  initialState?: {
      expanded?: boolean | Record<string, boolean>
  }
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterColumn,
  filterPlaceholder,
  isPaginated = true,
  children,
  tableId,
  columnVisibility,
  onColumnVisibilityChange,
  rowSelection = {},
  onRowSelectionChange = () => {},
  emptyStateTitle = "No Results Found",
  emptyStateDescription = "Your search did not match any items. Try a different query.",
  emptyStateIcon = SearchX,
  renderSubComponent,
  getSubRows,
  initialState = {},
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [expanded, setExpanded] = React.useState<ExpandedState>(initialState.expanded ?? {});


  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: onColumnVisibilityChange,
    onRowSelectionChange: onRowSelectionChange,
    getRowCanExpand: () => !!renderSubComponent,
    onExpandedChange: setExpanded,
    getSubRows: getSubRows,
    getExpandedRowModel: getExpandedRowModel(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      expanded,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  React.useEffect(() => {
    if (initialState.expanded) {
        table.toggleAllRowsExpanded(true);
    }
  }, [table, initialState.expanded]);

  return (
     <div className="flex flex-col h-full rounded-lg border">
        <div className="flex items-center justify-between p-4 border-b">
             <div className="relative w-full max-w-sm">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                {filterColumn && (
                    <Input
                        placeholder={filterPlaceholder || `Filter by ${filterColumn}...`}
                        value={(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ""}
                        onChange={(event) => table.getColumn(filterColumn)?.setFilterValue(event.target.value)
                        }
                        className="pl-10"
                    />
                )}
            </div>
            <div className="flex items-center gap-2">
                {children && children(table)}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="ml-auto">
                        Columns
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {table
                        .getAllColumns()
                        .filter(
                            (column) => column.getCanHide()
                        )
                        .map((column) => {
                            return (
                            <DropdownMenuCheckboxItem
                                key={column.id}
                                className="capitalize"
                                checked={column.getIsVisible()}
                                onCheckedChange={(value) =>
                                column.toggleVisibility(!!value)
                                }
                            >
                                {column.id.replace(/_/g, ' ')}
                            </DropdownMenuCheckboxItem>
                            )
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
        <div className="flex-1 overflow-auto">
            <Table>
            <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                    return (
                        <TableHead key={header.id}>
                        {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                            )}
                        </TableHead>
                    )
                    })}
                </TableRow>
                ))}
            </TableHeader>
            <TableBody>
                {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <TableRow
                    data-state={row.getIsSelected() && "selected"}
                    >
                    {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                    ))}
                    </TableRow>
                    {row.getIsExpanded() && renderSubComponent && (
                      <TableRow>
                          <TableCell colSpan={columns.length}>
                              {renderSubComponent({ row })}
                          </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
                ) : (
                <TableRow>
                    <TableCell colSpan={columns.length} className="h-48 text-center">
                        <EmptyState
                            icon={emptyStateIcon}
                            title={emptyStateTitle}
                            description={emptyStateDescription}
                        />
                    </TableCell>
                </TableRow>
                )}
            </TableBody>
            </Table>
        </div>
        {isPaginated && (
            <div className="flex items-center justify-end space-x-2 py-4 border-t px-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} of{" "}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                >
                Next
                </Button>
            </div>
        )}
    </div>
  )
}
