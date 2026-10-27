
'use client';

import * as React from 'react';
import { RoomTypeCard } from '../rooms/room-type-card';
import type { Booking, Room, IndividualRoom } from '@/lib/types';
import { DndCard } from '../dnd/dnd-card';
import { IndividualRoomCard } from './individual-room-card';
import { ReservationCard } from '../reservations/reservation-card';
import { ActiveBookingSubCard } from '../reservations/active-booking-sub-card';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';

export function RoomGrid(props: any) {
  const { items, activeTab } = props;
  const { userProfile } = useUser();
  const { settings } = useSettings();

  let contentToRender: React.ReactNode;

  switch (activeTab) {
    case 'All':
      contentToRender = (items as Room[]).map((room: Room) => (
        <RoomTypeCard key={room.id} room={room} allBookingsData={props.allBookingsData} setWalkInRoom={props.setWalkInRoom} userCurrency={settings?.currency || 'USD'} />
      ));
      break;
    case 'Active Check-ins':
      contentToRender = (items as IndividualRoom[]).map((room: IndividualRoom) => (
        <ActiveBookingSubCard key={`${room.id}-${room.roomNumber}`} booking={room.currentBooking!} {...props} />
      ));
      break;
    case 'Reserved':
      contentToRender = (items as Booking[]).map((booking: Booking) => (
        <ReservationCard key={booking.id} booking={booking} {...props} checkoutTime={settings?.checkoutTime || '11:00'} />
      ));
      break;
    case 'Do Not Disturb':
      contentToRender = (items as IndividualRoom[]).map((room: IndividualRoom) => (
        <DndCard key={`${room.id}-${room.roomNumber}`} item={room} onUpdateStatus={props.onUpdateRoomStatus} onViewDetails={props.setDetailsBooking} />
      ));
      break;
    default:
      contentToRender = (items as IndividualRoom[]).map((room: IndividualRoom) => (
        <IndividualRoomCard key={`${room.id}-${room.roomNumber}`} room={room} onUpdateRoomStatus={props.onUpdateRoomStatus} onViewBooking={props.setDetailsBooking} onBook={props.setWalkInRoom} userName={userProfile?.name} />
      ));
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
      {contentToRender}
    </div>
  );
}
