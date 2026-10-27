'use client';

import * as React from 'react';
import type { IndividualRoom, Booking, Room } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Bed, Clock, BellOff, Wind, Wrench, LogIn, CalendarClock, User } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { getInitials, getSafeDate } from '@/lib/helpers';
import { useSettings } from '@/contexts/settings-context';
import { Button } from '../ui/button';
import { RoomStatusUpdater } from '../rooms/room-status-updater';
import Link from 'next/link';
import { RoomStatusRoadmap } from '../rooms/room-status-roadmap';

interface IndividualRoomCardProps {
  room: IndividualRoom;
  onUpdateRoomStatus: (room: { id: string, roomNumber: string }, newStatus: string) => Promise<void>;
  onViewBooking: (booking: Booking) => void;
  onBook: (room: Room) => void;
  userName?: string;
}

export function IndividualRoomCard({ room, onUpdateRoomStatus, onViewBooking, onBook, userName }: IndividualRoomCardProps) {
  const queueItem = room.cleaningQueueItem || room.maintenanceQueueItem;
  const { settings } = useSettings();
  const userCurrency = settings?.currency || 'USD';

  const isVacant = room.status === 'Vacant';

  const guestName = room.currentBooking?.guestName || queueItem?.lastGuestName;
  const guestPhotoURL = room.currentBooking?.guestPhotoURL || queueItem?.lastGuestPhotoURL;
  const guestLabel = room.currentBooking ? "Current Guest" : "Last Guest";

  const rawDate = room.currentBooking?.checkInDate || queueItem?.checkedOutAt || room.statusMeta?.markedAt || queueItem?.reportedAt;
  const processedDate = getSafeDate(rawDate);

  let dateLabel = "Checked in";
  let actorLabel = "";
  let actorName = "";

  if (room.status === 'Cleaning in Progress' && room.cleaningQueueItem) {
      dateLabel = "Checked out";
      actorLabel = "by";
      actorName = room.cleaningQueueItem.booking?.checkedOutByName || room.cleaningQueueItem?.lastGuestBookingDetails?.checkedOutByName || 'System';
  } else if (room.status === 'Maintenance' && room.maintenanceQueueItem) {
      dateLabel = "Reported";
      actorLabel = "by";
      actorName = room.maintenanceQueueItem.reportedBy || 'System';
  } else if ((room.status === 'Occupied' || room.status === 'Active Check-ins') && room.currentBooking) {
      dateLabel = "Checked in";
      actorLabel = "by";
      actorName = room.currentBooking.checkedInByName || room.currentBooking.createdByName || 'System';
  } else if (room.statusMeta?.markedBy) {
      dateLabel = "Marked at";
      actorLabel = "by";
      actorName = room.statusMeta.markedBy;
  }


  const getStatusStyle = (status: string) => {
    if (status === 'Vacant') return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
    if (status === 'Cleaning in Progress') return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 blinking-red-bg-badge';
    if (status === 'Maintenance') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
    if (status === 'Occupied' || room.status === 'Active Check-ins') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300';
    return 'bg-muted text-muted-foreground';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'Vacant') return <Bed className="h-4 w-4" />;
    if (status === 'Cleaning in Progress') return <Wind className="h-4 w-4" />;
    if (status === 'Maintenance') return <Wrench className="h-4 w-4" />;
    if (status === 'Do Not Disturb') return <BellOff className="h-4 w-4" />;
    if (queueItem?.checkedOutAt || queueItem?.reportedAt || room.statusMeta?.markedAt) return <Clock className="h-4 w-4" />;
    return <Bed className="h-4 w-4" />;
  };

  const statusText = () => {
    if (isVacant) return "This room is clean and ready for the next guest.";
    if (room.status === 'Do Not Disturb') return "Please call this room before entering.";

    const dateToCompare = getSafeDate(queueItem?.checkedOutAt) || getSafeDate(queueItem?.reportedAt) || getSafeDate(room.statusMeta?.markedAt);
    if (dateToCompare) {
        return `Status set ${formatDistanceToNow(dateToCompare, { addSuffix: true })}`;
    }

    if ((room.status === 'Occupied' || room.status === 'Active Check-ins') && room.currentBooking?.checkInDate) {
      const checkInDate = getSafeDate(room.currentBooking.checkInDate);
      if (!checkInDate) return `Checked in...`;
      return `Checked in since ${formatDistanceToNow(checkInDate, { addSuffix: true })}`;
    }

    return `Hey ${userName?.split(' ')[0] || 'Manager'}, this room needs your attention!`;
  };


  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-xl">
          <span>Room {room.roomNumber}</span>
          <Badge variant="outline" className={cn('font-semibold', getStatusStyle(room.status))}>{room.status}</Badge>
        </CardTitle>
        <RoomStatusRoadmap room={room} />
        {room.maintenanceQueueItem?.reason && (
           <CardDescription className={cn(room.maintenanceQueueItem.reason.toLowerCase().includes('problem') && 'text-destructive font-semibold')}>
             {room.maintenanceQueueItem.reason}
           </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        {guestName && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">{guestLabel}</p>
             <button
              className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted"
              onClick={() => room.currentBooking && onViewBooking(room.currentBooking)}
              disabled={!room.currentBooking}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={guestPhotoURL || ''} />
                <AvatarFallback>{getInitials(guestName)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{guestName}</p>
                 {processedDate && (
                  <p className="text-xs text-muted-foreground">
                    {dateLabel} {format(processedDate, 'MMM d, p')} {actorLabel} <span className="font-medium">{actorName}</span>
                  </p>
                )}
              </div>
            </button>
          </div>
        )}
         {(guestName || (isVacant && room.reservations && room.reservations.length > 0)) && <Separator />}
        <div className={cn("flex items-center gap-3 text-sm",
            isVacant ? 'text-green-600 dark:text-green-400' :
            (queueItem?.checkedOutAt || queueItem?.reportedAt || room.status === 'Do Not Disturb' || room.statusMeta?.markedAt) ? 'text-yellow-600 dark:text-yellow-400' :
            'text-foreground')}>
          {getStatusIcon(room.status)}
          <p className="font-medium">{statusText()}</p>
        </div>
        {isVacant && room.reservations && room.reservations.length > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-md border bg-muted p-3">
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <CalendarClock className="h-4 w-4" />
              <span>
                {room.reservations.length} upcoming reservation(s)
              </span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/reservations?search=${room.roomNumber}`}>
                View
              </Link>
            </Button>
          </div>
        )}
        {isVacant && (
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: userCurrency }).format(room.price)}
            <span className="text-sm font-normal text-muted-foreground">/night</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-2 flex flex-col items-stretch gap-2">
         {isVacant && (
             <Button className="w-full" onClick={() => onBook(room as Room)}>
                <LogIn className="mr-2 h-4 w-4" /> Book / Check In
            </Button>
         )}
        {onUpdateRoomStatus && (
          <RoomStatusUpdater
              room={room}
              onUpdateStatus={onUpdateRoomStatus}
              excludeStatuses={['Reserved', 'Active Check-ins']}
          />
        )}
      </CardFooter>
    </Card>
  );
}
