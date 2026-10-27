
'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { SalonService, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ArrowUpDown, Printer, User } from 'lucide-react';
import { getSafeDate, getInitials } from '@/lib/helpers';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useSettings } from '@/contexts/settings-context';


type GetColumnsProps = {
  onPrintReceipt: (order: SalonService) => void;
  userMap: Map<string, UserProfile>;
  currency: string;
  onActions: (order: SalonService) => void;
};

export const getSalonHistoryColumns = ({ onPrintReceipt, userMap, currency, onActions }: GetColumnsProps): ColumnDef<SalonService>[] => {

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return [
    {
      accessorKey: 'orderNumber',
      header: 'Order #',
      cell: ({ row }) => <span className="font-mono">#{row.original.orderNumber}</span>,
    },
    {
      accessorKey: 'customerName',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Customer
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.customerName}</div>
          {row.original.roomNumber && <div className="text-xs text-muted-foreground">Room {row.original.roomNumber}</div>}
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
      header: 'Services',
      cell: ({ row }) => (
        <ul className="list-disc pl-4 text-xs">
          {row.original.items.map((item, index) => (
            <li key={index}>{item.name}</li>
          ))}
        </ul>
      ),
    },
    {
      accessorKey: 'totalPrice',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
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
      accessorKey: 'paymentStatus',
      header: 'Payment Status',
      cell: ({ row }) => (
        <Badge variant={row.original.paymentStatus === 'Paid' ? 'success' : 'warning'}>
          {row.original.paymentStatus}
        </Badge>
      ),
    },
    {
        accessorKey: 'paymentMethod',
        header: 'Payment Method',
        cell: ({ row }) => {
            return row.original.paymentMethod || <span className="text-muted-foreground text-xs">N/A</span>
        }
    },
    {
        id: 'staffName',
        header: 'Processed By',
        cell: ({ row }) => {
            const staffName = row.original.staffName;
            const staffId = row.original.staffId;
            const staffProfile = staffId ? userMap.get(staffId) : null;

            if (!staffName) return <span className="text-muted-foreground">N/A</span>;

            return (
                 <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={staffProfile?.photoURL} alt={staffProfile?.name} />
                        <AvatarFallback>
                        {staffProfile ? getInitials(staffProfile.name) : <User />}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-medium">{staffName}</span>
                        {staffProfile && <span className="text-xs text-muted-foreground">{staffProfile.email}</span>}
                    </div>
                </div>
            )
        }
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        return (
          <div className="text-right">
             <Button variant="outline" size="sm" onClick={() => onActions(row.original)}>
                Actions
            </Button>
          </div>
        );
      },
    },
  ];
};
