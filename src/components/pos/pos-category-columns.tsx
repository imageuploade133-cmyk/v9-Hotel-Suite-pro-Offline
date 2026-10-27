'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { StockCategory, ServiceCategory, StockItem, ServiceItem } from '@/lib/types';
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
  ConciergeBell,
  Link2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import Image from 'next/image';
import { Badge } from '../ui/badge';
import React from 'react';
import { useSettings } from '@/contexts/settings-context';

type POSCategory = (StockCategory | ServiceCategory) & {
  itemCount: number;
  subRows: (StockItem | ServiceItem)[];
  categoryType: 'stock' | 'service';
};

type GetColumnsProps = {
  onEdit: (category: StockCategory | ServiceCategory, type: 'stock' | 'service') => void;
  onDelete: (category: StockCategory | ServiceCategory, type: 'stock' | 'service', itemCount: number) => void;
};

export const getPOSCategoryColumns = ({
  onEdit,
  onDelete,
}: GetColumnsProps): ColumnDef<POSCategory>[] => [
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
      <div className="flex items-center gap-3">
        <button onClick={row.getToggleExpandedHandler()} className="p-1 hover:bg-muted rounded transition-colors">
          {row.getIsExpanded() ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="w-9 h-9 rounded-md overflow-hidden relative bg-muted flex-shrink-0 border">
          {row.original.imageUrl ? (
            <Image
              src={row.original.imageUrl}
              alt={row.original.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full w-full">
              {row.original.categoryType === 'stock'
                ? <Package className="h-4 w-4 text-muted-foreground" />
                : <ConciergeBell className="h-4 w-4 text-muted-foreground" />
              }
            </div>
          )}
        </div>
        <div className="font-medium">{row.original.name}</div>
      </div>
    ),
  },
  {
    accessorKey: 'categoryType',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.categoryType;
      return (
        <Badge variant={type === 'stock' ? 'default' : 'secondary'}>
          {type === 'stock' ? <Package className="h-3 w-3 mr-1" /> : <ConciergeBell className="h-3 w-3 mr-1" />}
          {type === 'stock' ? 'Stock' : 'Service'}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => row.original.description || <span className="text-muted-foreground italic">No description</span>,
  },
  {
    accessorKey: 'itemCount',
    header: 'Items',
    cell: ({ row }) => {
      const count = row.original.itemCount || 0;
      return (
        <Badge variant={count > 0 ? 'default' : 'secondary'}>
          {count} {count === 1 ? 'item' : 'items'}
        </Badge>
      );
    },
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
              <DropdownMenuItem onClick={() => onEdit(category, category.categoryType)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Category
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={() => onDelete(category, category.categoryType, category.itemCount)}
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

interface RenderSubComponentProps {
  row: any;
  onUnlink: (item: StockItem | ServiceItem, categoryType: 'stock' | 'service') => void;
  categoryType: 'stock' | 'service';
}

export const renderSubComponent = ({ row, onUnlink, categoryType }: RenderSubComponentProps) => {
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const globalStockImageUrl = settings?.globalStockImageUrl;
  const useGlobalStockImage = settings?.useGlobalStockImage;
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const items = row.original.subRows || [];
  const isStock = categoryType === 'stock';

  return (
    <div className="p-4 bg-muted/50">
      <h4 className="font-semibold mb-3 ml-2 flex items-center gap-2">
        {isStock ? <Package className="h-4 w-4" /> : <ConciergeBell className="h-4 w-4" />}
        Items in {row.original.name}
        <Badge variant="outline" className="ml-2">{items.length}</Badge>
      </h4>
      {items.length === 0 ? (
        <div className="text-muted-foreground text-sm ml-2 py-4">No items linked to this category.</div>
      ) : (
        <div className="space-y-2">
          {items.map((item: StockItem | ServiceItem) => {
            const primaryImage = (item.images && item.images.length > 0)
              ? item.images[0]
              : (useGlobalStockImage ? globalStockImageUrl : undefined);

            const isStockItem = 'quantity' in item;
            const quantity = isStockItem ? (item as StockItem).quantity : undefined;
            const sellingPrice = isStockItem ? (item as StockItem).sellingPrice : (item as ServiceItem).price;

            return (
              <div key={item.id} className="flex items-center gap-4 p-3 border bg-background rounded-md hover:bg-muted/30 transition-colors">
                <div className="w-10 h-10 rounded-md overflow-hidden relative bg-muted flex-shrink-0">
                  {primaryImage ? (
                    <Image src={primaryImage} alt={item.name} fill className="object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full w-full">
                      {isStock ? <Package className="h-5 w-5 text-muted-foreground" /> : <ConciergeBell className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.name}</div>
                  {item.description && (
                    <div className="text-sm text-muted-foreground truncate">{item.description}</div>
                  )}
                </div>
                {isStockItem && quantity !== undefined && (
                  <div className="w-24 text-center">
                    <Badge variant={quantity <= ((item as StockItem).lowStockThreshold || 0) ? (quantity === 0 ? 'destructive' : 'warning') : 'secondary'}>
                      {quantity} in stock
                    </Badge>
                  </div>
                )}
                <div className="w-28 text-right font-semibold">{formatCurrency(sellingPrice || 0)}</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onUnlink(item, categoryType)}
                  title="Unlink from category"
                >
                  <Link2 className="h-4 w-4 mr-1" />
                  Unlink
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
