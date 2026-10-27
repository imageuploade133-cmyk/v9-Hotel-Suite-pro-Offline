'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Printer } from 'lucide-react';
import { getSafeDate } from '@/lib/helpers';
import { format } from 'date-fns';

type IncomeData = {
    id: string;
    date: Date;
    description: string;
    amount: number;
    source: string;
    originalDoc: any;
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
        <div className="text-right font-semibold text-green-600">
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
            <Button variant="outline" size="sm" onClick={() => onReprint(income)}>
              <Printer className="mr-2 h-4 w-4" />
              Reprint
            </Button>
          </div>
        );
      },
    },
  ];
};