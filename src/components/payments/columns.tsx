'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Payment, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  ArrowUpDown,
  Eye,
  Printer,
  Undo2,
  User,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { getInitials } from '@/lib/helpers';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { usePermissions } from '@/hooks/use-permissions';
import { PagePermission } from '@/lib/permissions';

type GetColumnsProps = {
  onViewDetails: (payment: Payment) => void;
  onReprintReceipt: (payment: Payment) => void;
  onRefund: (payment: Payment) => void;
  currency: string;
};

const statusVariantMap: { [key: string]: 'success' | 'secondary' | 'destructive' | 'outline' | 'default' } = {
  'Active': 'success',
  'Checked-in': 'success',
  'Checked-out': 'secondary',
  'Cancelled': 'destructive',
  'Refunded': 'destructive',
  'Cancelled (Unpaid)': 'destructive',
  'Cancelled (Pre-paid)': 'destructive',
  'Cancelled (Active)': 'destructive',
  'Booked': 'outline',
  'Reserved': 'outline'
};


export const usePaymentColumns = ({
  onViewDetails,
  onReprintReceipt,
  onRefund,
  currency,
}: GetColumnsProps): ColumnDef<Payment>[] => {
  const firestore = useFirestore();
  const { hasPermission } = usePermissions();
  const canCancelBooking = hasPermission(PagePermission.CANCEL_BOOKING);
  const canProcessRefunds = hasPermission(PagePermission.PROCESS_SALE_REFUNDS);

  const usersQuery = React.useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  const { data: users } = useCollection<UserProfile>(usersQuery);
  const userMap = React.useMemo(() => {
    if (!users) return new Map();
    return new Map(users.map(u => [u.uid, u]));
  }, [users]);

  return React.useMemo(() => [
  {
    accessorKey: 'guestName',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Guest
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const payment = row.original;
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage
              src={payment.guestPhotoURL}
              alt={payment.guestName}
            />
            <AvatarFallback>{getInitials(payment.guestName || 'G')}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{payment.guestName}</span>
            <span className="text-xs text-muted-foreground">{payment.guestEmail}</span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Amount
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount'));
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
      }).format(amount);

      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'roomNumber',
    header: 'Room',
     cell: ({ row }) => {
        const roomNumber = row.getValue('roomNumber');
        return roomNumber ? `#${roomNumber}` : 'N/A';
     }
  },
  {
    accessorKey: 'paymentMethod',
    header: 'Payment Method',
  },
  {
    accessorKey: 'status',
    header: 'Booking Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const variant = statusVariantMap[status] || 'secondary';
      return <Badge variant={variant} className="capitalize">{status}</Badge>;
    }
  },
  {
    accessorKey: 'transactionDate',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const date = row.getValue('transactionDate') as Date;
      return <span>{format(date, 'EEEE dd-MM-yyyy')}</span>;
    },
  },
   {
      id: 'processedBy',
      header: 'Processed By',
      cell: ({ row }) => {
        const payment = row.original;
        let staffName = payment.createdByName;
        const staffId = payment.createdByUid;

        if (!staffName && staffId && userMap.has(staffId)) {
          staffName = userMap.get(staffId)?.name;
        }

        if (!staffName) return <span className="text-muted-foreground">System</span>;

        const staffProfile = staffId ? userMap.get(staffId) : Array.from(userMap.values()).find(u => u.name === staffName);

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
        );
      },
    },
  {
    id: 'actions',
    cell: ({ row }) => {
      const payment = row.original;
      const canRefund = payment.status !== 'Cancelled' && payment.status !== 'Refunded' && payment.status !== 'Checked-out' && canCancelBooking && canProcessRefunds;

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
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onViewDetails(payment)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onReprintReceipt(payment)}>
                <Printer className="mr-2 h-4 w-4" />
                Print Receipt
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={() => onRefund(payment)}
                disabled={!canRefund}
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Issue Refund
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
], [onViewDetails, onReprintReceipt, onRefund, currency, userMap, canCancelBooking, canProcessRefunds]);
};
