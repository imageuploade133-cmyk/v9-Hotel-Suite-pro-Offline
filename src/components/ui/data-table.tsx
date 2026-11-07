

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
  OnChangeFn,
  functionalUpdate,
} from "@tanstack/react-table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { useUser } from "@/contexts/user-context"
import { useFirestore } from "@/firebase"
import { doc, FieldPath, getDoc, setDoc, updateDoc } from "firebase/firestore"

type StoredColumnVisibility = {
  visibility: VisibilityState;
  updatedAt: number;
};

function getColumnVisibilityStorageKey(uid: string, tableId: string): string {
  return `app_table_column_visibility_v1_${encodeURIComponent(uid)}_${encodeURIComponent(tableId)}`;
}

function normalizeColumnVisibility(value: unknown, columnIds: string[]): VisibilityState {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const normalized: VisibilityState = {};

  columnIds.forEach((columnId) => {
    if (typeof source[columnId] === "boolean") {
      normalized[columnId] = source[columnId] as boolean;
    }
  });

  // Missing keys intentionally mean visible. This also keeps newly added columns
  // visible for users whose saved preference predates the new column.
  return normalized;
}

function parseStoredColumnVisibility(value: unknown, columnIds: string[]): StoredColumnVisibility | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const hasEnvelope = !!record.visibility && typeof record.visibility === "object";
  const visibility = hasEnvelope ? record.visibility : value;
  const updatedAt = hasEnvelope && typeof record.updatedAt === "number"
    ? record.updatedAt
    : 0;

  return {
    visibility: normalizeColumnVisibility(visibility, columnIds),
    updatedAt,
  };
}

function readLocalColumnVisibility(uid: string, tableId: string, columnIds: string[]): StoredColumnVisibility | null {
  if (typeof window === "undefined") return null;

  const keys = [
    getColumnVisibilityStorageKey(uid, tableId),
    // Migrate the preference format introduced for Running Tables before
    // column visibility became a shared project-wide DataTable feature.
    ...(tableId === "running-tables-table"
      ? [`app_running_tables_columns_${encodeURIComponent(uid)}`]
      : []),
  ];

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = parseStoredColumnVisibility(JSON.parse(raw), columnIds);
      if (parsed) return parsed;
    } catch {
      // An unavailable or malformed local preference must never break the table.
    }
  }

  return null;
}

function getFirebaseAdminColumnPreferenceDocId(tableId: string): string {
  return tableId === "running-tables-table"
    ? "runningTables"
    : `tableColumns_${encodeURIComponent(tableId)}`;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  filterColumn?: string
  filterPlaceholder?: string
  isPaginated?: boolean
  children?: (table: ReturnType<typeof useReactTable<TData>>) => React.ReactNode
  tableId: string
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>
  columnLabels?: Record<string, string>
  columnVisibilityLoading?: boolean
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
  columnLabels,
  columnVisibilityLoading = false,
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
  const [expanded, setExpanded] = React.useState<ExpandedState>(initialState.expanded ?? {})
  const [internalColumnVisibility, setInternalColumnVisibility] = React.useState<VisibilityState>({})
  const [columnVisibilityUpdatedAt, setColumnVisibilityUpdatedAt] = React.useState(0)
  const [columnVisibilityDirty, setColumnVisibilityDirty] = React.useState(false)
  const [columnPreferencesLoadedFor, setColumnPreferencesLoadedFor] = React.useState<string | null>(null)
  const { user, userProfile } = useUser()
  const firestore = useFirestore()

  const currentUserUid = user?.uid || userProfile?.uid || userProfile?.id || null
  const isFirebaseOnlyAdmin = userProfile?.isFirebaseOnlyAdmin === true
  const columnVisibilityChangeRef = React.useRef(onColumnVisibilityChange)
  const isColumnVisibilityControlledRef = React.useRef(columnVisibility !== undefined)
  columnVisibilityChangeRef.current = onColumnVisibilityChange
  isColumnVisibilityControlledRef.current = columnVisibility !== undefined
  const preferenceScope = currentUserUid ? `${currentUserUid}:${tableId}` : null
  const activeColumnVisibility = columnVisibility ?? internalColumnVisibility

  const handleColumnVisibilityChange = React.useCallback<OnChangeFn<VisibilityState>>((updater) => {
    const nextVisibility = functionalUpdate(updater, activeColumnVisibility)

    // DataTable owns visibility state by default. Existing callers may still
    // provide controlled state; those callers continue to receive the updater.
    if (columnVisibility === undefined) {
      setInternalColumnVisibility(nextVisibility)
    }
    onColumnVisibilityChange?.(updater)
    setColumnVisibilityUpdatedAt(Date.now())
    setColumnVisibilityDirty(true)
  }, [activeColumnVisibility, columnVisibility, onColumnVisibilityChange])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onRowSelectionChange: onRowSelectionChange,
    getRowCanExpand: () => !!renderSubComponent,
    onExpandedChange: setExpanded,
    getSubRows: getSubRows,
    getExpandedRowModel: getExpandedRowModel(),
    state: {
      sorting,
      columnFilters,
      columnVisibility: activeColumnVisibility,
      rowSelection,
      expanded,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  const columnIdsKey = table.getAllLeafColumns().map(column => column.id).join("|")
  const columnIds = React.useMemo(
    () => columnIdsKey ? columnIdsKey.split("|") : [],
    [columnIdsKey]
  )

  // Restore the current user's saved columns for this specific table. Staff
  // profiles use their existing profile document; Firebase-only Admins use a
  // preference subdocument so no staff profile is created just for UI settings.
  React.useEffect(() => {
    if (!currentUserUid || !preferenceScope) {
      setInternalColumnVisibility({})
      setColumnVisibilityUpdatedAt(0)
      setColumnVisibilityDirty(false)
      setColumnPreferencesLoadedFor(null)
      return
    }

    let cancelled = false
    setColumnPreferencesLoadedFor(null)
    setColumnVisibilityDirty(false)

    const localPreference = readLocalColumnVisibility(currentUserUid, tableId, columnIds)
    const profilePreferences = userProfile?.uiPreferences as Record<string, any> | undefined
    const currentProfileVisibility = profilePreferences?.tableColumnVisibility?.[tableId]
    const currentProfileUpdatedAt = profilePreferences?.tableColumnVisibilityUpdatedAt?.[tableId]
    const currentProfilePreference = currentProfileVisibility
      ? {
          visibility: currentProfileVisibility,
          updatedAt: typeof currentProfileUpdatedAt === "number" ? currentProfileUpdatedAt : 0,
        }
      : (tableId === "running-tables-table"
          ? profilePreferences?.runningTablesColumnVisibility
          : undefined)
    const profilePreference = parseStoredColumnVisibility(currentProfilePreference, columnIds)

    const initialPreference = profilePreference && (
      !localPreference || profilePreference.updatedAt >= localPreference.updatedAt
    )
      ? profilePreference
      : localPreference

    const loadedVisibility = initialPreference?.visibility || {}
    setInternalColumnVisibility(loadedVisibility)
    setColumnVisibilityUpdatedAt(initialPreference?.updatedAt || 0)
    if (isColumnVisibilityControlledRef.current) {
      columnVisibilityChangeRef.current?.(loadedVisibility)
    }

    const finishLoading = () => {
      if (!cancelled) setColumnPreferencesLoadedFor(preferenceScope)
    }

    if (isFirebaseOnlyAdmin && firestore) {
      getDoc(doc(
        firestore,
        "users",
        currentUserUid,
        "preferences",
        getFirebaseAdminColumnPreferenceDocId(tableId)
      )).then(snapshot => {
        if (cancelled) return

        const remotePreference = snapshot.exists()
          ? parseStoredColumnVisibility(snapshot.data().columnVisibility, columnIds)
          : null

        if (remotePreference && (
          !localPreference || remotePreference.updatedAt >= localPreference.updatedAt
        )) {
          setInternalColumnVisibility(remotePreference.visibility)
          setColumnVisibilityUpdatedAt(remotePreference.updatedAt)
          if (isColumnVisibilityControlledRef.current) {
            columnVisibilityChangeRef.current?.(remotePreference.visibility)
          }
        } else if (localPreference && (
          !remotePreference || localPreference.updatedAt > remotePreference.updatedAt
        )) {
          // The local choice is newer (often because this device was offline).
          // Queue it for synchronization when Firestore becomes reachable.
          setInternalColumnVisibility(localPreference.visibility)
          setColumnVisibilityUpdatedAt(localPreference.updatedAt)
          if (isColumnVisibilityControlledRef.current) {
            columnVisibilityChangeRef.current?.(localPreference.visibility)
          }
          setColumnVisibilityDirty(true)
        }
      }).catch(error => {
        console.warn(`[DataTable:${tableId}] Could not load saved column preferences:`, error)
        if (localPreference) {
          // Keep the local layout and queue it for synchronization after
          // connectivity is restored.
          setColumnVisibilityDirty(true)
        }
      }).finally(finishLoading)
    } else {
      if (localPreference && (
        !profilePreference || localPreference.updatedAt > profilePreference.updatedAt
      )) {
        // Preserve a locally saved offline layout and synchronize it after the
        // user's profile is available instead of leaving it on this device only.
        setColumnVisibilityDirty(true)
      }
      finishLoading()
    }

    return () => {
      cancelled = true
    }
  }, [
    currentUserUid,
    preferenceScope,
    tableId,
    columnIdsKey,
    isFirebaseOnlyAdmin,
    firestore,
    userProfile?.id,
    userProfile?.uiPreferences,
  ])

  // Persist a change immediately on this device and debounce the profile write
  // so rapidly ticking several columns results in one Firestore update.
  React.useEffect(() => {
    if (
      !currentUserUid
      || !preferenceScope
      || columnPreferencesLoadedFor !== preferenceScope
      || !columnVisibilityDirty
    ) return

    const safeVisibility = normalizeColumnVisibility(activeColumnVisibility, columnIds)
    const updatedAt = columnVisibilityUpdatedAt || Date.now()
    const storedValue: StoredColumnVisibility = {
      visibility: safeVisibility,
      updatedAt,
    }

    try {
      window.localStorage.setItem(
        getColumnVisibilityStorageKey(currentUserUid, tableId),
        JSON.stringify(storedValue)
      )
    } catch (error) {
      console.warn(`[DataTable:${tableId}] Could not save local column preferences:`, error)
    }

    if (!firestore) return

    const timeoutId = window.setTimeout(() => {
      const write = isFirebaseOnlyAdmin
        ? setDoc(
            doc(
              firestore,
              "users",
              currentUserUid,
              "preferences",
              getFirebaseAdminColumnPreferenceDocId(tableId)
            ),
            {
              columnVisibility: safeVisibility,
              updatedAt,
            },
            { merge: true }
          )
        : userProfile?.id
          ? updateDoc(
              doc(firestore, "users", userProfile.id),
              new FieldPath("uiPreferences", "tableColumnVisibility", tableId),
              safeVisibility,
              new FieldPath("uiPreferences", "tableColumnVisibilityUpdatedAt", tableId),
              updatedAt
            )
          : Promise.reject(new Error("The signed-in profile is not available."))

      write.catch(error => {
        console.warn(`[DataTable:${tableId}] Could not synchronize column preferences:`, error)
      })
    }, 400)

    return () => window.clearTimeout(timeoutId)
  }, [
    activeColumnVisibility,
    columnVisibilityUpdatedAt,
    columnVisibilityDirty,
    columnPreferencesLoadedFor,
    currentUserUid,
    preferenceScope,
    tableId,
    columnIdsKey,
    firestore,
    isFirebaseOnlyAdmin,
    userProfile?.id,
  ])

  React.useEffect(() => {
    if (initialState.expanded) {
        table.toggleAllRowsExpanded(true);
    }
  }, [table, initialState.expanded]);

  const isColumnMenuLoading = columnVisibilityLoading
    || (!!preferenceScope && columnPreferencesLoadedFor !== preferenceScope)

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
                        <Button variant="outline" className="ml-auto" disabled={isColumnMenuLoading}>
                        {isColumnMenuLoading ? "Loading columns..." : "Columns"}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto">
                        <DropdownMenuItem
                            onSelect={() => table.setColumnVisibility({})}
                            className="font-medium"
                        >
                            Show all columns
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {table
                        .getAllColumns()
                        .filter((column) => column.getCanHide())
                        .map((column) => {
                            const fallbackLabel = typeof column.columnDef.header === "string"
                                ? column.columnDef.header
                                : column.id.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, value => value.toUpperCase());
                            return (
                            <DropdownMenuCheckboxItem
                                key={column.id}
                                checked={column.getIsVisible()}
                                onSelect={(event) => event.preventDefault()}
                                onCheckedChange={(value) =>
                                    column.toggleVisibility(value === true)
                                }
                            >
                                {columnLabels?.[column.id] || fallbackLabel}
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
                          <TableCell colSpan={Math.max(1, row.getVisibleCells().length)}>
                              {renderSubComponent({ row })}
                          </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
                ) : (
                <TableRow>
                    <TableCell colSpan={Math.max(1, table.getVisibleLeafColumns().length)} className="h-48 text-center">
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
