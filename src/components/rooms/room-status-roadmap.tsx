'use client';

import * as React from 'react';
import type { IndividualRoom } from '@/lib/types';
import { ArrowRight, User } from 'lucide-react';

export function RoomStatusRoadmap({ room }: { room: IndividualRoom }) {
  let previousStatus = '';
  let actorName = '';
  let actionText = 'Marked as';

  if (room.status === 'Cleaning in Progress') {
    previousStatus = 'Occupied';
    actorName = room.cleaningQueueItem?.booking?.checkedOutByName || room.cleaningQueueItem?.lastGuestBookingDetails?.checkedOutByName || 'System';
    actionText = 'Checked out by';
  } else if (room.status === 'Maintenance') {
    actorName = room.maintenanceQueueItem?.reportedBy || 'System';
    actionText = 'Reported by';
  } else if (room.status === 'Inspection') {
    previousStatus = 'Cleaning';
    actorName = room.statusMeta?.markedBy || 'Staff';
    actionText = 'Marked for Inspection by';
  } else if (room.currentBooking?.status === 'Active' || room.currentBooking?.status === 'Checked-in') {
    previousStatus = 'Vacant';
    actorName = room.currentBooking.checkedInByName || 'System';
    actionText = 'Checked in by';
  } else if (room.statusMeta?.markedBy) {
    actorName = room.statusMeta.markedBy;
    actionText = 'Marked by';
  }

  if (!actorName) {
    return null; // Don't show anything if there's no clear action trail
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
      {previousStatus && (
        <>
          <span className="font-semibold">{previousStatus}</span>
          <ArrowRight className="h-3 w-3" />
        </>
      )}
      <User className="h-3 w-3" />
      <span>{actionText} <b>{actorName}</b></span>
    </div>
  );
}
