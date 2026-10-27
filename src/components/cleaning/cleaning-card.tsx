
'use client';

import * as React from 'react';
import type { Booking, Room } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDistanceToNow, format } from 'date-fns';
import { getInitials } from '@/lib/helpers';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { RoomStatusUpdater } from '@/components/rooms/room-status-updater';
import { Wind, Clock, User } from 'lucide-react';

interface CleaningItemWithData {
    id: string;
    roomId: string;
    roomNumber: string;
    lastGuestName: string;
    lastGuestPhotoURL?: string;
    bookingId: string;
    checkedOutAt: any;
    roomType: Room | null;
    booking: Booking | null;
}

interface CleaningCardProps {
    item: CleaningItemWithData;
    onConfirm: (room: { id: string, roomNumber: string }, status: string) => void;
    onViewDetails: (booking: Booking) => void;
}

export function CleaningCard({ item, onConfirm, onViewDetails }: CleaningCardProps) {
  const checkedOutDate = item.checkedOutAt?.toDate();

  return (
    <Card className="flex flex-col bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl text-red-600 dark:text-red-400">
          <Wind className="h-5 w-5" />
          Room {item.roomNumber}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Last Guest</p>
          <button
            className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-red-100/50 dark:hover:bg-red-900/30"
            onClick={() => item.booking && onViewDetails(item.booking)}
            disabled={!item.booking}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={item.lastGuestPhotoURL || undefined} />
              <AvatarFallback>{getInitials(item.lastGuestName)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{item.lastGuestName}</p>
              {checkedOutDate && (
                 <p className="text-xs text-muted-foreground">
                  Checked out {format(checkedOutDate, 'MMM d, p')}
                </p>
              )}
            </div>
          </button>
        </div>
        <Separator />
        <div className="flex items-center gap-3 text-sm text-red-700 dark:text-red-300">
          <Clock className="h-4 w-4" />
          <p className="font-medium">
            Waiting for cleaning{' '}
            {checkedOutDate ? formatDistanceToNow(checkedOutDate, { addSuffix: true }) : ''}
          </p>
        </div>
      </CardContent>
      <CardFooter className="p-2 bg-red-100/50 dark:bg-red-900/10">
        <RoomStatusUpdater
            room={{ id: item.roomId, roomNumber: item.roomNumber, status: 'Cleaning in Progress' } as any}
            onUpdateStatus={onConfirm}
            excludeStatuses={['Cleaning in Progress', 'Occupied', 'Do Not Disturb']}
        />
      </CardFooter>
    </Card>
  );
}
