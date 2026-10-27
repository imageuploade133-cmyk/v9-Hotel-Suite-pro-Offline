
'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { Expense } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ArrowUpDown, Edit, Trash2, Printer } from 'lucide-react';
import { getSafeDate } from '@/lib/helpers';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

type GetColumnsProps = {
  currency: string;
  onActions: (expense: Expense) => void;
};

export const getExpenseColumns = ({ currency, onActions }: GetColumnsProps): ColumnDef<Expense>[] => {
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return [
    {
      accessorKey: 'date',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = getSafeDate(row.original.date);
        return date ? format(date, 'PP') : 'N/A';
      },
    },
    {
      accessorKey: 'description',
      header: 'Description',
    },
    {
      accessorKey: 'category',
      header: 'Category',
    },
    {
      accessorKey: 'paymentMethod',
      header: 'Payment Method',
    },
    {
        accessorKey: 'staffName',
        header: 'Processed By',
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="w-full justify-end">
          Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className={cn("font-semibold text-right", row.original.status === 'Voided' && 'line-through text-muted-foreground')}>
          {formatCurrency(row.original.amount)}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = (row.original as any).status;
        if (status === 'Voided') {
          return <Badge variant="destructive">Voided</Badge>;
        }
        return <Badge variant="success">Recorded</Badge>;
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const expense = row.original;

        return (
            <div className="text-right">
                <Button variant="outline" size="sm" onClick={() => onActions(expense)}>
                    Actions
                </Button>
            </div>
        )
      },
    },
  ];
};

