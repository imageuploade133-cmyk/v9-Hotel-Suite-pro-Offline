'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Printer, MoreHorizontal } from 'lucide-react';
import { getSafeDate } from '@/lib/helpers';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type IncomeData = {
    id: string;
    date: Date;
    description: string;
    amount: number;
    source: string;
    user?: string;
};

type GetIncomeColumnsProps = {
    currency: string;
    onReprint: (income: IncomeData) => void;
};

export const getIncomeColumns = ({ currency, onReprint }: GetIncomeColumnsProps): ColumnDef<IncomeData>[] => {
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: ({ row }) => <div className="font-mono text-xs">{row.original.id.substring(0, 8)}...</div>,
    },
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
        return date ? format(date, 'EEEE dd-MM-yyyy') : 'N/A';
      },
    },
    {
      accessorKey: 'description',
      header: 'Description',
    },
    {
        accessorKey: 'source',
        header: 'Source',
    },
    {
        accessorKey: 'user',
        header: 'Processed By',
        cell: ({ row }) => row.original.user || 'System',
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => (
        <div className="text-right">
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Amount
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right font-semibold text-primary">
          {formatCurrency(row.original.amount)}
        </div>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const income = row.original;
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
                <DropdownMenuItem onClick={() => onReprint(income)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Reprint Receipt
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
};
