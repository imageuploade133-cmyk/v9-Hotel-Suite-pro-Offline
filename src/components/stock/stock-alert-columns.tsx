
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import type { StockItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { Package } from 'lucide-react';
import { Badge } from '../ui/badge';

type GetStockAlertColumnsProps = {
  quantities: Record<string, string>;
  onQuantityChange: (itemId: string, value: string) => void;
  onRestock?: (item: StockItem, quantity: string) => void;
  onSaveQuantity?: (itemId: string, itemName: string) => void;
  savingStates: Record<string, boolean>;
  useGlobalStockImage?: boolean;
  globalStockImageUrl?: string;
};

export const getStockAlertColumns = ({
  quantities,
  onQuantityChange,
  onRestock,
  onSaveQuantity,
  savingStates,
  useGlobalStockImage,
  globalStockImageUrl
}: GetStockAlertColumnsProps): ColumnDef<StockItem>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Item
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
    header: 'Current Stock',
    cell: ({ row }) => {
      const { quantity, lowStockThreshold = 0 } = row.original;
      const isOutOfStock = quantity <= 0;
      const isLowStock = quantity > 0 && quantity <= lowStockThreshold;

      return (
        <div className="flex items-center gap-2">
            <span className="font-bold text-lg">{quantity}</span>
            {isOutOfStock && <Badge variant="destructive">Out of Stock</Badge>}
            {isLowStock && <Badge variant="warning">Low Stock</Badge>}
        </div>
      );
    },
  },
  {
    accessorKey: 'lowStockThreshold',
    header: 'Threshold',
    cell: ({ row }) => row.original.lowStockThreshold || 'N/A',
  },
];
