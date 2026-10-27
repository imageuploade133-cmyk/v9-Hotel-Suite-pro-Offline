
'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { Bill, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ArrowUpDown, User, Printer } from 'lucide-react';
import { getSafeDate, getInitials } from '@/lib/helpers';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import React from 'react';
import { useSettings } from '@/contexts/settings-context';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

type GetBillColumnsProps = {
  onReprint: (bill: Bill) => void;
  currency: string;
  userMap: Map<string, UserProfile>;
};

export const useBillColumns = ({ currency, userMap, onReprint }: GetBillColumnsProps): ColumnDef<Bill>[] => {
  const { settings } = useSettings();

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return React.useMemo(() => [
    {
        id: 'guestInfo',
        header: 'Guest',
        cell: ({ row }) => {
            const bill = row.original;
            const booking = (bill as any).booking;
            if (!booking) return <div className="font-medium">{(bill as any).guestName || 'N/A'}</div>;
            return (
                 <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={booking.guestPhotoURL || undefined} alt={booking.guestName} />
                        <AvatarFallback>{getInitials(booking.guestName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-medium">{booking.guestName}</span>
                        <span className="text-xs text-muted-foreground">Room {booking.roomNumber}</span>
                    </div>
                </div>
            )
        }
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
      cell: ({ row }) => {
        const items = row.original.items;
        if (!items || items.length === 0) {
          return <span className="text-muted-foreground text-xs">No items</span>;
        }
        return (
          <ul className="list-disc pl-4 text-xs">
            {items.map((item, index) => (
              <li key={index}>{item.name} (x{item.quantity})</li>
            ))}
          </ul>
        );
      },
    },
    {
      accessorKey: 'total',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Total Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-right font-semibold">{formatCurrency(row.original.total)}</div>
      ),
    },
    {
        accessorKey: 'paid',
        header: 'Status',
        cell: ({ row }) => {
            return row.original.paid ? <Badge variant="success">Paid</Badge> : <Badge variant="warning">Unpaid</Badge>
        }
    },
    {
      id: 'processedBy',
      header: 'Processed By',
      cell: ({ row }) => {
        const bill = row.original;
        const staffName = bill.createdByName;
        const staffId = bill.createdBy;
        const staffProfile = staffId ? userMap.get(staffId) : null;
        if (!staffName) return <span className="text-muted-foreground">System</span>;

        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={staffProfile?.photoURL || undefined} alt={staffProfile?.name} />
              <AvatarFallback>{staffProfile ? getInitials(staffProfile.name) : <User />}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium">{staffName}</span>
              {staffProfile && <span className="text-xs text-muted-foreground">{staffProfile.email}</span>}
            </div>
          </div>
        );
      },
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
              <DropdownMenuItem onClick={() => onReprint(row.original)}>
                <Printer className="mr-2 h-4 w-4" />
                Reprint Receipt
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
  ], [currency, userMap, onReprint]);
};
