'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { StockCategory, StockItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  ArrowUpDown,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Package,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import Image from 'next/image';
import { Badge } from '../ui/badge';
import React from 'react';
import { useSettings } from '@/contexts/settings-context';

type GetColumnsProps = {
  onEdit: (category: StockCategory) => void;
  onDelete: (category: StockCategory) => void;
};

export const getStockCategoryColumns = ({
  onEdit,
  onDelete,
}: GetColumnsProps): ColumnDef<StockCategory & { itemCount: number; subRows: StockItem[] }>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Category Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
        <div className="flex items-center gap-2">
           <button onClick={row.getToggleExpandedHandler()} className="p-1">
                {row.getIsExpanded() ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <div className="font-medium">{row.original.name}</div>
        </div>
    ),
  },
  {
    accessorKey: 'description',
    header: 'Description',
  },
  {
    accessorKey: 'itemCount',
    header: 'Items',
    cell: ({ row }) => <div className="text-center">{row.original.itemCount || 0}</div>,
  },
  {
    accessorKey: 'createdBy',
    header: 'Created By',
  },
  {
    accessorKey: 'createdAt',
    header: 'Date Added',
    cell: ({ row }) => {
      const date = getSafeDate(row.original.createdAt);
      return date ? formatDistanceToNow(date, { addSuffix: true }) : 'N/A';
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const category = row.original;
      return (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(category)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Category
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={() => onDelete(category)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Category
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export const renderSubComponent = ({ row }: { row: any }) => {
    const { settings } = useSettings();
    const currency = settings?.currency || 'USD';
    const globalStockImageUrl = settings?.globalStockImageUrl;
    const useGlobalStockImage = settings?.useGlobalStockImage;
    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

    return (
        <div className="p-4 bg-muted/50">
            <h4 className="font-semibold mb-2 ml-2">Items in {row.original.name}</h4>
            <div className="space-y-2">
                {row.original.subRows.map((item: StockItem) => {
                    const primaryImage = (item.images && item.images.length > 0) ? item.images[0] : (useGlobalStockImage ? globalStockImageUrl : undefined);
                    return (
                        <div key={item.id} className="flex items-center gap-4 p-2 border bg-background rounded-md">
                             <div className="w-10 h-10 rounded-md overflow-hidden relative bg-muted flex-shrink-0">
                                {primaryImage ? (
                                <Image src={primaryImage} alt={item.name} fill className="object-cover" />
                                ) : (
                                <div className="flex items-center justify-center h-full w-full"><Package className="h-5 w-5 text-muted-foreground"/></div>
                                )}
                            </div>
                            <div className="flex-1 font-medium">{item.name}</div>
                            <div className="w-24 text-center">
                                <Badge variant={item.quantity <= (item.lowStockThreshold || 0) ? (item.quantity === 0 ? 'destructive' : 'warning') : 'secondary'}>
                                    {item.quantity} in stock
                                </Badge>
                            </div>
                            <div className="w-28 text-right font-semibold">{formatCurrency(item.sellingPrice || 0)}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
