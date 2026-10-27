
'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { Booking } from '@/lib/types';
import { getSafeDate, getInitials } from '@/lib/helpers';
import { format } from 'date-fns';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu';
import Link from 'next/link';

type UseReservationColumnsProps = {
  onViewDetails: (booking: Booking) => void;
  currency: string;
};

export const useReservationColumns = ({ onViewDetails, currency }: UseReservationColumnsProps): ColumnDef<Booking>[] => {

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return [
    {
      accessorKey: 'bookingId',
      header: 'Booking ID',
    },
    {
      accessorKey: 'guestName',
      header: 'Guest',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={row.original.guestPhotoURL || undefined} alt={row.original.guestName} />
            <AvatarFallback>{getInitials(row.original.guestName)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{row.original.guestName}</p>
            <p className="text-xs text-muted-foreground">{row.original.guestEmail}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'roomNumber',
      header: 'Room',
      cell: ({ row }) => `Room ${row.original.roomNumber}`,
    },
    {
      accessorKey: 'checkInDate',
      header: 'Check-in Date',
      cell: ({ row }) => format(getSafeDate(row.original.checkInDate)!, 'PPP'),
    },
    {
      accessorKey: 'checkOutDate',
      header: 'Check-out Date',
      cell: ({ row }) => format(getSafeDate(row.original.checkOutDate)!, 'PPP'),
    },
    {
      accessorKey: 'totalAmount',
      header: 'Amount',
      cell: ({ row }) => (row.original.totalAmount ? formatCurrency(row.original.totalAmount) : 'N/A'),
    },
    {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) => {
            const source = row.original.source || 'staff';
            return <Badge variant={source === 'website' ? 'default' : 'secondary'}>{source}</Badge>;
        },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const variant = row.original.status === 'Reserved' ? 'success' : 'outline';
        return <Badge variant={variant}>{row.original.status}</Badge>;
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onViewDetails(row.original)}>View Details</DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/reservations/${row.original.id}`}>Manage</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
};
