
'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { SalaryReward } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ArrowUpDown, Trash2, Printer } from 'lucide-react';
import { getSafeDate } from '@/lib/helpers';
import { format } from 'date-fns';

type GetColumnsProps = {
  currency: string;
  onActions: (reward: SalaryReward) => void;
};

export const getRewardHistoryColumns = ({ currency, onActions }: GetColumnsProps): ColumnDef<SalaryReward>[] => {
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
      header: 'Given By',
    },
    {
      accessorKey: 'notes',
      header: 'Reason',
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
        <div className="font-semibold text-right text-green-600">
          {formatCurrency(row.original.amount)}
        </div>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const reward = row.original;

        return (
          <div className="text-right">
            <Button variant="outline" size="sm" onClick={() => onActions(reward)}>
              Actions
            </Button>
          </div>
        );
      },
    },
  ];
};
