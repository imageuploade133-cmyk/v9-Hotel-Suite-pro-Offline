
'use client';

import * as React from 'react';
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
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, ArrowUpDown, Edit, Trash2, Eye, Search, ConciergeBell, Package } from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import type { ServiceItem, StockSale } from '@/lib/types';
import { EmptyState } from '@/components/ui/empty-state';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import { Skeleton } from '../ui/skeleton';
import Image from 'next/image';
import { Badge } from '../ui/badge';

export type UnifiedItem = ServiceItem & { sourceType: 'Service' | 'Menu Item' };

interface ServiceManagementProps {
    salesData: StockSale[] | null;
    onEdit: (item: UnifiedItem) => void;
    onDelete: (item: UnifiedItem) => void;
    onViewSales: (item: UnifiedItem) => void;
    reloadCounter: number;
}

const getServiceColumns = (
    onEdit: (item: UnifiedItem) => void,
    onDelete: (item: UnifiedItem) => void,
    onViewSales: (item: UnifiedItem) => void,
    currency: string,
    globalStockImageUrl?: string,
    useGlobalStockImage?: boolean
): ColumnDef<UnifiedItem>[] => [
    {
        accessorKey: "images",
        header: "Image",
        cell: ({ row }) => {
            const item = row.original;
            const images = item.images;
            const primaryImage = (images && images.length > 0) ? images[0] : (useGlobalStockImage ? globalStockImageUrl : undefined);
            return (
                 <div className="w-12 h-12 rounded-md overflow-hidden relative group/image bg-muted">
                    {primaryImage ? (
                       <Image
                            src={primaryImage}
                            alt={item.name}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full w-full">
                           <ConciergeBell className="h-5 w-5 text-muted-foreground"/>
                        </div>
                    )}
                 </div>
            );
        },
        enableSorting: false,
    },
  {
    accessorKey: 'name',
    header: ({ column }) => <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>Name <ArrowUpDown className="ml-2 h-4 w-4" /></Button>,
    cell: ({ row }) => (
      <div>
        <p className="font-semibold">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">{row.original.description}</p>
      </div>
    )
  },
  {
    accessorKey: 'price',
    header: ({ column }) => <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>Price <ArrowUpDown className="ml-2 h-4 w-4" /></Button>,
    cell: ({ row }) => <div className="font-semibold">{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(row.original.price || 0)}</div>
  },
  {
    accessorKey: 'quantity',
    header: 'Quantity',
    cell: ({ row }) => {
        const quantity = row.original.quantity;
        if (quantity === Infinity || quantity === undefined) {
            return <Badge variant="secondary">Unlimited</Badge>
        }
        return <div className="text-center font-bold text-lg">{quantity}</div>;
    }
  },
  {
    accessorKey: 'category',
    header: 'Category',
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewSales(item)}><Eye className="mr-2 h-4 w-4" />View Sales Log</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(item)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(item)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export function ServiceManagement({ salesData, onEdit, onDelete, onViewSales, reloadCounter }: ServiceManagementProps) {
    const firestore = useFirestore();
    const { settings } = useSettings();
    const { getCollectionPath, isGlobalMode } = useBranch();

    // Branch mode queries
    const branchServicesQuery = React.useMemo(() => {
        return !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('services')), orderBy('name')) : null;
    }, [firestore, isGlobalMode, getCollectionPath, reloadCounter]);
    const branchServicesResult = useCollection<ServiceItem>(branchServicesQuery);

    // Global mode queries
    const globalServicesResult = useGlobalCollectionData<ServiceItem>('services', [orderBy('name')]);

    // Use appropriate result based on mode
    const { data: services, isLoading: areServicesLoading } = isGlobalMode ? globalServicesResult : branchServicesResult;

    const unifiedItems: UnifiedItem[] = React.useMemo(() => {
        return (services || []).map(s => ({ ...s, sourceType: 'Service' as 'Service' }));
    }, [services]);

    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

    const columns = React.useMemo(() => getServiceColumns(onEdit, onDelete, onViewSales, settings?.currency || 'USD', settings?.globalStockImageUrl, settings?.useGlobalStockImage), [onEdit, onDelete, onViewSales, settings]);

    const table = useReactTable({
        data: unifiedItems,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: { sorting, columnFilters },
    });

    const isLoading = areServicesLoading;

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between">
                    <Skeleton className="h-10 w-1/3" />
                </div>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        );
    }

    if (unifiedItems.length === 0) {
        return <EmptyState icon={ConciergeBell} title="No Services or Foods Found" description="Add a non-inventory service or food item to get started." />
    }

    return (
        <div>
            <div className="flex items-center py-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filter by name..."
                        value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
                        onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
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
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
             <div className="flex items-center justify-end space-x-2 py-4">
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
        </div>
    )
}
