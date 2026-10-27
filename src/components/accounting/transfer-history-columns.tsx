
'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { Transfer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Printer, MoreHorizontal } from 'lucide-react';
import { getSafeDate } from '@/lib/helpers';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';

type GetTransferHistoryColumnsProps = {
  currency: string;
  onActions: (transfer: Transfer) => void;
};

export const getTransferHistoryColumns = ({ currency, onActions }: GetTransferHistoryColumnsProps): ColumnDef<Transfer>[] => {

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return [
    {
      accessorKey: 'transferredAt',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = getSafeDate(row.original.transferredAt);
        return date ? format(date, 'PPpp') : 'N/A';
      },
    },
    {
      accessorKey: 'fromAccount',
      header: 'From',
    },
    {
      accessorKey: 'toAccount',
      header: 'To',
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="text-right font-semibold">{formatCurrency(row.original.amount)}</div>,
    },
    {
        accessorKey: 'transferredByName',
        header: 'Processed By',
    },
    {
        accessorKey: 'notes',
        header: 'Notes',
        cell: ({ row }) => <p className="text-xs italic text-muted-foreground">{row.original.notes || 'N/A'}</p>,
    },
    {
        id: 'actions',
        cell: ({ row }) => (
            <div className="text-right">
                <Button variant="outline" size="sm" onClick={() => onActions(row.original)}>
                    Actions
                </Button>
            </div>
        )
    }
  ];
};
