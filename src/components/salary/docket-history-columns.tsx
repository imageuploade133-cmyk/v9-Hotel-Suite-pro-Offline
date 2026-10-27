
'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { SalaryDeduction } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, ArrowUpDown, Trash2, Printer } from 'lucide-react';
import { getSafeDate } from '@/lib/helpers';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

type GetColumnsProps = {
  currency: string;
  onActions: (docket: SalaryDeduction) => void;
};

export const getDocketHistoryColumns = ({ currency, onActions }: GetColumnsProps): ColumnDef<SalaryDeduction>[] => {
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
        return date ? format(date, 'PPpp') : 'N/A';
      },
    },
    {
      accessorKey: 'userName',
      header: 'Staff',
    },
    {
        accessorKey: 'processedBy',
        header: 'Processed By',
    },
    {
      accessorKey: 'notes',
      header: 'Reason / Notes',
      cell: ({ row }) => <p className="italic">"{row.original.notes || 'N/A'}"</p>
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
        <div className={cn("font-semibold text-right", row.original.status === 'Reversed' ? 'text-muted-foreground line-through' : 'text-destructive')}>
          {formatCurrency(row.original.amount)}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        if (status === 'Reversed') {
          return <Badge variant="secondary">Reversed</Badge>;
        }
        return <Badge variant="destructive">Active</Badge>;
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const docket = row.original;
        return (
          <div className="text-right">
            <Button variant="outline" size="sm" onClick={() => onActions(docket)}>
                Actions
            </Button>
          </div>
        );
      },
    },
  ];
};
