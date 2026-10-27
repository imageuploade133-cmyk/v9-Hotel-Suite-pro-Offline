'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { ProductPerformanceData } from './page';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, TrendingUp, TrendingDown, Package, MoreHorizontal, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

type GetColumnsProps = {
  currency: string;
  onActions: (product: ProductPerformanceData) => void;
  globalStockImageUrl?: string;
  useGlobalStockImage?: boolean;
}

export const getProductSalesColumns = ({currency, onActions, globalStockImageUrl, useGlobalStockImage}: GetColumnsProps): ColumnDef<ProductPerformanceData>[] => {
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return [
    {
        id: "image",
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
                        <div className="flex items-center justify-center h-full w-full text-muted-foreground text-xs">
                           No Image
                        </div>
                    )}
                 </div>
            );
        },
        enableSorting: false,
    },
    {
      accessorKey: 'name',
      header: 'Product',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.category}</div>
        </div>
      ),
    },
    {
      accessorKey: 'currentStock',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Current Stock
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const stock = row.original.currentStock;
        const lowStockThreshold = row.original.lowStockThreshold || 0;
        let variant: 'success' | 'warning' | 'destructive' = 'success';
        let text = 'In Stock';

        if (stock <= 0) {
            variant = 'destructive';
            text = 'Out of Stock';
        } else if (stock <= lowStockThreshold) {
            variant = 'warning';
            text = 'Low Stock';
        }

        return (
            <div className="flex flex-col items-center">
                <span className="font-bold text-lg">{stock}</span>
                <Badge variant={variant} className="w-24 justify-center">{text}</Badge>
            </div>
        );
      },
    },
    {
      accessorKey: 'unitsSold',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Units Sold
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="text-center font-medium">{row.original.unitsSold}</div>,
    },
    {
      accessorKey: 'grossRevenue',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Gross Revenue
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="text-right font-semibold">{formatCurrency(row.original.grossRevenue)}</div>,
    },
    {
      accessorKey: 'netProfit',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Net Profit
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const profit = row.original.netProfit;
        const isPositive = profit >= 0;
        return (
          <div className={`text-right font-semibold ${isPositive ? 'text-green-600' : 'text-destructive'}`}>
            {formatCurrency(profit)}
          </div>
        );
      },
    },
    {
      accessorKey: 'profitMargin',
      header: 'Profit Margin',
      cell: ({ row }) => {
        const margin = row.original.profitMargin || 0;
        const isPositive = margin >= 0;
        return (
          <div className={`flex items-center justify-end gap-1 font-semibold ${isPositive ? 'text-green-600' : 'text-destructive'}`}>
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {margin.toFixed(1)}%
          </div>
        );
      },
    },
     {
      id: 'actions',
      cell: ({ row }) => {
        return (
            <div className="text-right">
                <Button variant="outline" size="sm" onClick={() => onActions(row.original)}>
                    Actions
                </Button>
            </div>
        );
      },
    },
  ];
};