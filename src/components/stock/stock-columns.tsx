'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import type { StockItem, Settings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, ArrowUpDown, Edit, Trash2 } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import Image from 'next/image';
import { Package } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type GetStockColumnsProps = {
  onEdit: (item: StockItem) => void;
  onDelete: (item: StockItem) => void;
  settings: Settings | null;
};

export const getStockColumns = ({ onEdit, onDelete, settings }: GetStockColumnsProps): ColumnDef<StockItem>[] => {
  const currency = settings?.currency || 'USD';
  const globalStockImageUrl = settings?.globalStockImageUrl;
  const useGlobalStockImage = settings?.useGlobalStockImage;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Item Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const item = row.original;
        const primaryImage = (item.images && item.images.length > 0) ? item.images[0] : (useGlobalStockImage ? globalStockImageUrl : undefined);
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md overflow-hidden relative bg-muted flex-shrink-0">
              {primaryImage ? (
                <Image src={primaryImage} alt={item.name} fill className="object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full w-full"><Package className="h-5 w-5 text-muted-foreground"/></div>
              )}
            </div>
            <div>
              <div className="font-medium">{item.name}</div>
              <div className="text-xs text-muted-foreground">{item.category}</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Quantity
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="text-center font-bold text-lg">{row.original.quantity}</div>,
    },
    {
      accessorKey: 'costPrice',
      header: () => <div className="text-right">Cost Price</div>,
      cell: ({ row }) => <div className="text-right">{formatCurrency(row.original.costPrice || 0)}</div>,
    },
    {
      accessorKey: 'sellingPrice',
      header: () => <div className="text-right">Selling Price</div>,
      cell: ({ row }) => <div className="text-right">{formatCurrency(row.original.sellingPrice || 0)}</div>,
    },
    {
      accessorKey: 'supplier',
      header: 'Supplier',
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(row.original)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
};
