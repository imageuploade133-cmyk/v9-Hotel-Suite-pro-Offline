
'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { StockReturn } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ArrowUpDown, Eye, Printer, FileText } from 'lucide-react';
import { getSafeDate } from '@/lib/helpers';
import { format } from 'date-fns';

type GetColumnsProps = {
  currency: string;
  onViewDetails: (refund: StockReturn) => void;
  onViewOriginalSale: (saleId: string) => void;
  onReprint: (refund: StockReturn) => void;
  onActions: (refund: StockReturn) => void;
};

export const getRefundsColumns = ({
  currency,
  onViewDetails,
  onViewOriginalSale,
  onReprint,
  onActions,
}: GetColumnsProps): ColumnDef<StockReturn>[] => {
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return [
    {
      accessorKey: 'refundId',
      header: 'Refund ID',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.refundId}</span>,
    },
    {
      accessorKey: 'returnedAt',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = getSafeDate(row.original.returnedAt);
        return date ? format(date, 'PPpp') : 'N/A';
      },
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
    },
    {
        accessorKey: 'items',
        header: 'Items Returned',
        cell: ({ row }) => {
            const items = row.original.items;
            return (
                <ul className="list-disc pl-4 text-xs">
                    {items.map((item, index) => (
                        <li key={index}>{item.itemName} (x{item.quantity})</li>
                    ))}
                </ul>
            )
        }
    },
    {
      accessorKey: 'totalRefundAmount',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="w-full justify-end">
          Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-semibold text-right text-destructive">
          {formatCurrency(row.original.totalRefundAmount)}
        </div>
      ),
    },
    {
      accessorKey: 'processedByName',
      header: 'Processed By',
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const refund = row.original;

        return (
          <div className="text-right">
             <Button variant="outline" size="sm" onClick={() => onActions(refund)}>
                Actions
            </Button>
          </div>
        );
      },
    },
  ];
};
