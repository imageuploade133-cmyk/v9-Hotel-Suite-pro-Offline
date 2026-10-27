'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { Order, Bill } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ArrowUpDown, Printer } from 'lucide-react';
import { getSafeDate } from '@/lib/helpers';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';

type GetColumnsProps = {
  onPrintReceipt: (order: Order) => void;
  currency: string;
  allBills: Bill[];
};

export const getKitchenHistoryColumns = ({ onPrintReceipt, currency, allBills }: GetColumnsProps): ColumnDef<Order>[] => {
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return [
    {
      accessorKey: 'orderNumber',
      header: 'Order #',
      cell: ({ row }) => <span className="font-mono">#{row.original.orderNumber}</span>,
    },
    {
      accessorKey: 'guestName',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Guest
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.guestName}</div>
          <div className="text-xs text-muted-foreground">Room {row.original.roomNumber}</div>
        </div>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = getSafeDate(row.original.createdAt);
        return date ? format(date, 'PPpp') : 'N/A';
      },
    },
    {
      accessorKey: 'items',
      header: 'Items',
      cell: ({ row }) => (
        <ul className="list-disc pl-4 text-xs">
          {row.original.items.map((item, index) => (
            <li key={`${item.id}-${index}`}>{item.name} (x{item.quantity})</li>
          ))}
        </ul>
      ),
    },
    {
      accessorKey: 'totalPrice',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="w-full justify-end">
          Total
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-semibold text-right">
          {formatCurrency(row.original.totalPrice)}
        </div>
      ),
    },
    {
        id: 'paymentStatus',
        header: 'Payment Status',
        cell: ({ row }) => {
            const order = row.original;
            const billForItem = (allBills || []).find(b => b.items.some(i => i.id.startsWith(`order-${order.orderNumber}`)));

            if (billForItem?.paid) {
                 return <Badge variant="success">Paid</Badge>;
            }
            if (billForItem) {
                return <Badge variant="warning">Billed (Unpaid)</Badge>;
            }

            return <Badge variant="secondary">{order.status}</Badge>;
        }
    },
    {
      accessorKey: 'completedByName',
      header: 'Processed By',
      cell: ({ row }) => row.original.completedByName || row.original.billedByName || 'N/A'
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        return (
          <div className="text-right">
            <Button variant="outline" size="sm" onClick={() => onPrintReceipt(row.original)}>
              <Printer className="mr-2 h-4 w-4" />
              Reprint
            </Button>
          </div>
        );
      },
    },
  ];
};
