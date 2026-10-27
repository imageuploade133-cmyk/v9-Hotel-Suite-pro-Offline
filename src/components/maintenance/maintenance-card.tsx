
'use client';

import * as React from 'react';
import type { Booking } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDistanceToNow } from 'date-fns';
import { getInitials } from '@/lib/helpers';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { RoomStatusUpdater } from '@/components/rooms/room-status-updater';
import { Wrench, Clock, User } from 'lucide-react';

interface MaintenanceItemWithData {
  id: string;
  roomId: string;
  roomNumber: string;
  reason: string;
  reportedBy: string;
  reportedAt: any;
  lastGuestName?: string;
  bookingId?: string;
  roomType: any;
  booking?: Booking | null;
}

interface MaintenanceCardProps {
  item: MaintenanceItemWithData;
  onConfirm: (room: any, status: string) => void;
  onViewDetails: (booking: Booking) => void;
}

export function MaintenanceCard({
  item,
  onConfirm,
  onViewDetails,
}: MaintenanceCardProps) {
  const reportedAtDate = item.reportedAt?.toDate();

  return (
    <Card className="flex flex-col bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl text-yellow-600 dark:text-yellow-400">
          <Wrench className="h-5 w-5" />
          Room {item.roomNumber}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <p className="font-semibold text-yellow-800 dark:text-yellow-200">{item.reason}</p>

        {item.lastGuestName && (
          <>
            <Separator />
            <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                Last Guest
                </p>
                <button
                className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-yellow-100/50 dark:hover:bg-yellow-900/30"
                onClick={() => item.booking && onViewDetails(item.booking)}
                disabled={!item.booking}
                >
                <Avatar className="h-10 w-10">
                    <AvatarImage src={item.booking?.guestPhotoURL || undefined} />
                    <AvatarFallback>{getInitials(item.lastGuestName)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{item.lastGuestName}</p>
                </div>
                </button>
            </div>
          </>
        )}
        <Separator />
        <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <p>Reported by <b>{item.reportedBy}</b></p>
            </div>
            <div className="flex items-center gap-3 text-yellow-700 dark:text-yellow-300">
                <Clock className="h-4 w-4" />
                {reportedAtDate ? (
                    <p className="font-medium">
                        Waiting for maintenance for{' '}
                        {formatDistanceToNow(reportedAtDate, { addSuffix: true })}
                    </p>
                ) : (
                    <p className="font-medium">Maintenance request pending...</p>
                )}
            </div>
        </div>
      </CardContent>
      <CardFooter className="p-2 bg-yellow-100/50 dark:bg-yellow-900/10">
        <RoomStatusUpdater
          room={{
            ...item.roomType,
            id: item.roomId,
            roomNumber: item.roomNumber,
            status: 'Maintenance',
          } as any}
          onUpdateStatus={(room, status) => onConfirm(room, status)}
          excludeStatuses={['Maintenance', 'Occupied']}
        />
      </CardFooter>
    </Card>
  );
}
