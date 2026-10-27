
'use client';

import * as React from 'react';
import type { IndividualRoom, Booking } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BellOff, Bed, User } from 'lucide-react';
import { format } from 'date-fns';
import { getInitials, getSafeDate } from '@/lib/helpers';
import { RoomStatusUpdater } from '@/components/rooms/room-status-updater';
import { Button } from '@/components/ui/button';

interface DndCardProps {
  item: IndividualRoom;
  onUpdateStatus: (room: any, status: string) => void;
  onViewDetails: (booking: Booking) => void;
}

export function DndCard({
  item,
  onUpdateStatus,
  onViewDetails,
}: DndCardProps) {
  const guest = item.currentBooking;
  const checkInDate = getSafeDate(guest?.checkInDate);

  return (
    <Card className="flex flex-col border-2 border-orange-400 bg-orange-50/50 dark:border-orange-700 dark:bg-orange-900/20">
      <CardHeader>
        <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
                <Bed className="h-5 w-5" />
                Room {item.roomNumber}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-600 dark:text-orange-400">
                <BellOff className="h-5 w-5" />
                <span>Do Not Disturb</span>
            </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        {guest ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              Current Guest
            </p>
            <button
              className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted"
              onClick={() => onViewDetails(guest)}
              disabled={!guest}
            >
              <Avatar className="h-10 w-10 border-2">
                <AvatarImage src={guest.guestPhotoURL || undefined} />
                <AvatarFallback>{getInitials(guest.guestName)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{guest.guestName}</p>
                 {checkInDate && (
                    <p className="text-xs text-muted-foreground">
                        Checked in: {format(checkInDate, 'MMM d, p')}
                    </p>
                )}
              </div>
            </button>
          </div>
        ) : (
             <div className="flex items-center gap-3 text-sm text-muted-foreground p-2">
                <User className="h-5 w-5" />
                <span>No guest information available.</span>
            </div>
        )}
      </CardContent>
      <CardFooter className="p-2 bg-orange-100/30 dark:bg-orange-900/10">
        <RoomStatusUpdater
          room={item}
          onUpdateStatus={onUpdateStatus}
          excludeStatuses={['Do Not Disturb', 'Reserved']}
        />
      </CardFooter>
    </Card>
  );
}
