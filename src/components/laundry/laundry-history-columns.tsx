
'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { LaundryOrder, Bill } from '@/lib/types';
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
  onPrintReceipt: (order: LaundryOrder) => void;
  currency: string;
  allBills: Bill[];
};

export const getLaundryHistoryColumns = ({ onPrintReceipt, currency, allBills }: GetColumnsProps): ColumnDef<LaundryOrder>[] => {
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return [
    {
      accessorKey: 'orderNumber',
      header: 'Order #',
      cell: ({ row }) => <span className="font-mono">#{row.original.orderNumber}</span>,
    },
    {
      accessorKey: 'guestName',
      header: 'Guest',
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
            <li key={`${item.name}-${index}`}>{item.name} (x{item.quantity})</li>
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
        const billForItem = allBills.find(b => b.items.some(i => i.id.startsWith(`laundry-${row.original.orderNumber}`)));
        if (billForItem?.paid) {
            return <Badge variant="success">Paid</Badge>;
        }
        return <Badge variant="warning">Billed to Room</Badge>;
      }
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <Badge variant={row.original.status === 'Delivered' ? 'secondary' : 'success'}>{row.original.status}</Badge>
    },
    {
      accessorKey: 'staffName',
      header: 'Processed By',
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onPrintReceipt(row.original)}>
                <Printer className="mr-2 h-4 w-4" />
                Print Receipt
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
};
