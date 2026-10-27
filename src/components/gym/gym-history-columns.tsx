'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { Payment, GymMembershipPlan, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ArrowUpDown, Printer, Phone, User, Undo2 } from 'lucide-react';
import { getSafeDate } from '@/lib/helpers';
import { format, isBefore, isWithinInterval, addDays } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { getInitials } from '@/lib/helpers';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import React from 'react';

type GymPaymentHistoryItem = Payment & {
  expiresAt?: any,
  planId?: string,
  membershipFee?: number,
  phoneNumber?: string,
  memberPhotoURL?: string,
  createdByName?: string,
  createdByUid?: string,
};


type GetColumnsProps = {
  currency: string;
  membershipPlans: GymMembershipPlan[];
  onReprintReceipt: (payment: Payment) => void;
  onRefund: (payment: Payment) => void;
  userMap: Map<string, UserProfile>;
  canManageMembers: boolean;
};

export const getGymHistoryColumns = ({ currency, membershipPlans, onReprintReceipt, onRefund, userMap, canManageMembers }: GetColumnsProps): ColumnDef<GymPaymentHistoryItem>[] => {

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return [
    {
      accessorKey: 'guestName',
      header: 'Member',
      cell: ({ row }) => {
        const member = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={member.memberPhotoURL} alt={member.guestName} />
              <AvatarFallback>{getInitials(member.guestName || '')}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium">{member.guestName}</span>
              <span className="text-xs text-muted-foreground">{member.guestEmail}</span>
              {member.phoneNumber && <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />{member.phoneNumber}</span>}
            </div>
          </div>
        )
      },
    },
    {
        id: 'processedBy',
        header: 'Processed By',
        cell: ({ row }) => {
            const payment = row.original;
            const staffName = payment.createdByName;
            const staffId = payment.createdByUid;
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
      accessorKey: 'transactionDate',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          RG. Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = getSafeDate(row.original.transactionDate);
        return date ? (
          <div className="flex flex-col">
            <span>{format(date, 'EEEE, MMM d, yyyy')}</span>
            <span className="text-xs text-muted-foreground">{format(date, 'p')}</span>
          </div>
        ) : 'N/A';
      },
    },
    {
      accessorKey: 'planId',
      header: 'Plan',
      cell: ({ row }) => {
        const plan = membershipPlans.find(p => p.id === row.original.planId);
        return plan ? plan.name : 'N/A';
      }
    },
    {
      accessorKey: 'membershipFee',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Fee Paid
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const fee = row.original.membershipFee;
        return fee !== undefined ? <div className="font-semibold text-right">{formatCurrency(fee)}</div> : 'N/A';
      },
    },
    {
        accessorKey: 'expiresAt',
        header: ({ column }) => (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Expires On
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => {
            const date = getSafeDate(row.original.expiresAt);
            if (!date) return 'N/A';

            const isExpired = isBefore(date, new Date());

            return (
              <div className={cn("flex flex-col", isExpired && "text-destructive")}>
                <span>{format(date, 'EEEE, MMM d, yyyy')}</span>
                <span className={cn("text-xs", isExpired ? "text-destructive/80" : "text-muted-foreground")}>{format(date, 'p')}</span>
              </div>
            )
        },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const payment = row.original;

        if (payment.status === 'Refunded') {
            return <Badge variant="destructive">Refunded</Badge>;
        }

        const expiresAt = getSafeDate(payment.expiresAt);
        if (!expiresAt) return <Badge variant="secondary">Unknown</Badge>;

        const now = new Date();
        const expiryThreshold = addDays(now, 7);

        let variant: 'success' | 'warning' | 'destructive' = 'success';
        let text = 'Active';

        if (isBefore(expiresAt, now)) {
          variant = 'destructive';
          text = 'Expired';
        } else if (isWithinInterval(expiresAt, { start: now, end: expiryThreshold })) {
          variant = 'warning';
          text = 'Expiring Soon';
        }

        return <Badge variant={variant}>{text}</Badge>;
      }
    },
    {
      accessorKey: 'paymentMethod',
      header: 'Payment Method',
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
              <DropdownMenuItem onClick={() => onReprintReceipt(row.original)}>
                <Printer className="mr-2 h-4 w-4" />
                Reprint Receipt
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onRefund(row.original)}
                disabled={row.original.status === 'Refunded' || !canManageMembers}
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Issue Refund
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
};
