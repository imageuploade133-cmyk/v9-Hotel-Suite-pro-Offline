
'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { StockSale } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ArrowUpDown, CreditCard, Printer } from 'lucide-react';
import { getSafeDate } from '@/lib/helpers';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export type CreditSale = StockSale & {
    totalPaid: number;
    outstandingBalance: number;
}

type GetColumnsProps = {
  currency: string;
  onActions: (sale: CreditSale) => void;
};

export const getCreditSalesColumns = ({ currency, onActions }: GetColumnsProps): ColumnDef<CreditSale>[] => {

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return [
    {
      accessorKey: 'saleId',
      header: 'Sale ID',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.saleId}</span>
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
    },
    {
      accessorKey: 'soldAt',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = getSafeDate(row.original.soldAt);
        return date ? format(date, 'EEEE dd-MM-yyyy, p') : 'N/A';
      },
    },
    {
      accessorKey: 'totalAmount',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Total Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-semibold text-right">
          {formatCurrency(row.original.totalAmount)}
        </div>
      ),
    },
    {
      accessorKey: 'totalPaid',
      header: () => <div className="text-right">Amount Paid</div>,
      cell: ({ row }) => (
        <div className="font-semibold text-right text-green-600 dark:text-green-500">
          {formatCurrency(row.original.totalPaid)}
        </div>
      ),
    },
     {
      accessorKey: 'outstandingBalance',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="text-right w-full justify-end">
          Balance Due
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const balance = row.original.outstandingBalance;
        return (
          <div className={`text-right font-bold ${balance > 0 ? 'text-destructive' : 'text-green-600 dark:text-green-500'}`}>
            {formatCurrency(balance)}
          </div>
        );
      },
    },
    {
      accessorKey: 'soldByName',
      header: 'Sold By',
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const sale = row.original;
        return (
          <div className="text-right">
            <Button variant="outline" size="sm" onClick={() => onActions(sale)}>
                Actions
            </Button>
          </div>
        );
      },
    },
  ];
};

