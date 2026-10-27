
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown, Eye, Printer, User, FileX2 } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { Timestamp } from 'firebase/firestore'
import Link from 'next/link';

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "../ui/checkbox"
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar"
import { getInitials, getSafeDate } from "@/lib/helpers"
import type { Booking, UserProfile } from "@/lib/types"
import React from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Badge } from '../ui/badge';
import { useSettings } from '@/contexts/settings-context';

type UseHistoryColumnsProps = {
  onViewDetails: (booking: Booking) => void;
  onReprintReceipt: (booking: Booking) => void;
  onReprintCancellation: (booking: Booking) => void;
  activeTab: 'checkouts' | 'checkins' | 'reservations' | 'cancellations' | 'logins';
  userMap: Map<string, UserProfile>;
};

const statusVariantMap: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' } = {
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


export const useHistoryColumns = ({
  onViewDetails,
  onReprintReceipt,
  onReprintCancellation,
  activeTab,
  userMap,
}: UseHistoryColumnsProps): ColumnDef<Booking>[] => {
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';

  return React.useMemo(() => {

    const getActorColumn = (): ColumnDef<Booking> => {
      let header = 'Processed By';
      let uidAccessor: keyof Booking = 'checkedOutByUid';
      let nameAccessor: keyof Booking = 'checkedOutByName';

      switch (activeTab) {
        case 'checkins':
          header = 'Checked-in By';
          uidAccessor = 'checkedInByUid';
          nameAccessor = 'checkedInByName';
          break;
        case 'reservations':
          header = 'Created By';
          uidAccessor = 'createdByUid';
          nameAccessor = 'createdByName';
          break;
        case 'checkouts':
          header = 'Checked Out By';
          uidAccessor = 'checkedOutByUid';
          nameAccessor = 'checkedOutByName';
          break;
        case 'cancellations':
          header = 'Cancelled By';
          uidAccessor = 'cancelledByUid';
          nameAccessor = 'cancelledByName';
          break;
      }

      return {
        id: 'actor',
        header: header,
        cell: ({ row }) => {
          let staffName = row.original[nameAccessor] as string | undefined;
          const staffId = row.original[uidAccessor] as string | undefined;

          // Fallback logic
          if (!staffName && staffId && userMap.has(staffId)) {
            staffName = userMap.get(staffId)?.name;
          }

          if (activeTab === 'checkins' && !staffId && !staffName) {
              const creatorId = row.original.createdByUid;
              const creatorName = row.original.createdByName;
              if (creatorId && userMap.has(creatorId) && !creatorName) {
                staffName = userMap.get(creatorId)?.name;
              } else {
                staffName = creatorName;
              }
          }

          if (!staffName) return <span className="text-muted-foreground">System</span>;

          const staffProfile = staffId ? userMap.get(staffId) : Array.from(userMap.values()).find(u => u.name === staffName);

          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={staffProfile?.photoURL || undefined} alt={staffProfile?.name} />
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
      };
    };


    const allColumns: { [key: string]: ColumnDef<Booking> } = {
        guest: {
            accessorKey: 'guestName',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Guest
                <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const booking = row.original;
                return (
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                    <AvatarImage src={booking.guestPhotoURL || undefined} alt={booking.guestName} />
                    <AvatarFallback>{getInitials(booking.guestName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                    <span className="font-medium">{booking.guestName}</span>
                    <span className="text-xs text-muted-foreground">{booking.guestEmail}</span>
                    </div>
                </div>
                );
            },
        },
        room: {
            accessorKey: 'roomNumber',
            header: 'Room',
            cell: ({ row }) => {
                const roomNumber = row.getValue('roomNumber');
                return <div className="text-center">{roomNumber ? `#${roomNumber}` : 'N/A'}</div>;
            }
        },
        checkInDate: {
            accessorKey: 'checkInDate',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Check-in
                <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const date = getSafeDate(row.getValue('checkInDate'));
                return <span>{date ? format(date, 'EEEE, dd-MM-yyyy') : 'N/A'}</span>;
            },
        },
        checkOutDate: {
            accessorKey: 'checkOutDate',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Scheduled Out
                <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const date = getSafeDate(row.getValue('checkOutDate'));
                return <span>{date ? format(date, 'EEEE, dd-MM-yyyy') : 'N/A'}</span>;
            },
        },
        actualCheckOutDate: {
            accessorKey: 'actualCheckOutDate',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Checked Out At
                <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const date = getSafeDate(row.getValue('actualCheckOutDate'));
                if (!date) return <span className="text-muted-foreground">N/A</span>;
                return (
                <div className="flex flex-col">
                    <span>{format(date, 'EEEE, dd-MM-yyyy, p')}</span>
                    <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(date, { addSuffix: true })}
                    </span>
                </div>
                );
            },
        },
        totalAmount: {
            accessorKey: 'totalAmount',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Total Amount
                <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const amount = row.getValue('totalAmount') as number | undefined;
                if (amount === undefined || amount === null) {
                    return <span className="text-muted-foreground">N/A</span>;
                }
                const formatted = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: currency,
                }).format(amount);

                return <div className="font-medium text-right">{formatted}</div>;
            }
        },
        createdAt: {
            accessorKey: 'createdAt',
            header: 'Booked On',
             cell: ({ row }) => {
                const date = getSafeDate(row.original.createdAt);
                if (!date) return <span className="text-muted-foreground">N/A</span>;
                return (
                    <div className="flex flex-col">
                        <span>{format(date, 'EEEE, dd-MM-yyyy')}</span>
                        <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(date, { addSuffix: true })}
                        </span>
                    </div>
                )
             }
        },
        cancelledAt: {
            accessorKey: 'cancelledAt',
            header: 'Cancelled On',
             cell: ({ row }) => {
                const date = getSafeDate(row.original.cancelledAt);
                if (!date) return <span className="text-muted-foreground">N/A</span>;
                return (
                    <div className="flex flex-col">
                        <span>{format(date, 'EEEE, dd-MM-yyyy')}</span>
                        <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(date, { addSuffix: true })}
                        </span>
                    </div>
                )
             }
        },
        status: {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const booking = row.original;
                let displayStatus = booking.status;

                if (booking.status === 'Cancelled' || booking.status === 'Refunded') {
                    if (booking.checkedInByUid) {
                        displayStatus = 'Cancelled (Active)';
                    } else if (booking.paymentMethod) { // It was a paid reservation
                        displayStatus = 'Cancelled (Pre-paid)';
                    } else { // It was an unpaid reservation
                        displayStatus = 'Cancelled (Unpaid)';
                    }
                } else if (booking.status === 'Booked') {
                    displayStatus = 'Reserved';
                }

                const variant = statusVariantMap[displayStatus] || 'secondary';
                return <Badge variant={variant} className="capitalize">{displayStatus}</Badge>;
            }
        },
        actions: {
            id: 'actions',
            cell: ({ row }) => {
                const booking = row.original;
                const isCancelled = booking.status === 'Cancelled' || booking.status === 'Refunded';
                return (
                <div className="text-right no-print">
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onViewDetails(booking)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Booking Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onReprintReceipt(booking)} disabled={isCancelled || !booking.paymentMethod}>
                            <Printer className="mr-2 h-4 w-4" />
                            Reprint Receipt
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onReprintCancellation(booking)} disabled={!isCancelled} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                          <FileX2 className="mr-2 h-4 w-4" />
                          Reprint Cancellation
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                );
            },
        },
    };

    let activeColumns: ColumnDef<Booking>[] = [];
    const actorColumn = getActorColumn();

    switch (activeTab) {
        case 'checkins':
            activeColumns = [allColumns.guest, allColumns.room, allColumns.totalAmount, allColumns.checkInDate, actorColumn, allColumns.status, allColumns.actions];
            break;
        case 'checkouts':
            activeColumns = [allColumns.guest, allColumns.room, allColumns.totalAmount, allColumns.actualCheckOutDate, actorColumn, allColumns.actions];
            break;
        case 'reservations':
            activeColumns = [allColumns.guest, allColumns.room, allColumns.totalAmount, allColumns.createdAt, actorColumn, allColumns.status, allColumns.actions];
            break;
        case 'cancellations':
             activeColumns = [allColumns.guest, allColumns.room, allColumns.totalAmount, allColumns.cancelledAt, actorColumn, allColumns.status, allColumns.actions];
             break;
        default:
            activeColumns = [allColumns.guest, allColumns.room, allColumns.totalAmount, allColumns.status, actorColumn, allColumns.actions];
    }
    return activeColumns;

  }, [activeTab, onViewDetails, onReprintReceipt, onReprintCancellation, userMap, currency, settings]);
};
