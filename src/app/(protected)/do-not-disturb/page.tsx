'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import {
  collection,
  query,
  doc,
  writeBatch,
  getDocs,
  where,
  increment,
  onSnapshot,
} from 'firebase/firestore';
import { BellOff, Bed } from 'lucide-react';
import type { Booking, Room, IndividualRoom } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/ui/empty-state';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import { DndCard } from '@/components/dnd/dnd-card';
import DoNotDisturbLoading from './loading';
import { TopHeader } from '@/components/top-header';

function DoNotDisturbPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dndRooms, setDndRooms] = React.useState<IndividualRoom[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(
    null
  );

  React.useEffect(() => {
    if (!firestore) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const roomsQuery = query(collection(firestore, 'rooms'));
    const bookingsQuery = query(
      collection(firestore, 'bookings'),
      where('status', 'in', ['Active', 'Checked-in'])
    );

    const unsubscribeRooms = onSnapshot(roomsQuery, () => {
      // When rooms change, re-fetch everything
      fetchAndFilterData();
    });

    const unsubscribeBookings = onSnapshot(bookingsQuery, () => {
      // When bookings change, re-fetch everything
      fetchAndFilterData();
    });

    const fetchAndFilterData = async () => {
       try {
         const [roomsSnapshot, bookingsSnapshot] = await Promise.all([
           getDocs(roomsQuery),
           getDocs(bookingsQuery),
         ]);

         const roomsData = roomsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
         const bookingsData = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));

         const bookingsByRoomNumber = new Map<string, Booking>();
         bookingsData.forEach(booking => {
           if (booking.roomNumber) {
             bookingsByRoomNumber.set(booking.roomNumber, booking);
           }
         });

         const filteredRooms: IndividualRoom[] = [];
         roomsData.forEach(roomType => {
           if (roomType.individualRoomStatus) {
             Object.entries(roomType.individualRoomStatus).forEach(([roomNumber, status]) => {
               if (status === 'Do Not Disturb') {
                 const currentBooking = bookingsByRoomNumber.get(roomNumber) || null;
                 filteredRooms.push({
                   ...roomType,
                   id: roomType.id,
                   roomNumber,
                   status: 'Do Not Disturb',
                   currentBooking,
                 });
               }
             });
           }
         });

         setDndRooms(filteredRooms);
       } catch (err) {
          console.error("Failed to fetch DND rooms", err);
          toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch room data.' });
       } finally {
          setIsLoading(false);
       }
    }

    fetchAndFilterData();

    return () => {
      unsubscribeRooms();
      unsubscribeBookings();
    };
  }, [firestore, toast]);

  const handleUpdateStatus = async (
    room: { id: string; roomNumber: string },
    newStatus: string
  ) => {
    if (!firestore) return;

    const batch = writeBatch(firestore);
    const roomTypeRef = doc(firestore, 'rooms', room.id);

    batch.update(roomTypeRef, {
      [`individualRoomStatus.${room.roomNumber}`]:
        newStatus === 'Vacant' ? null : newStatus,
    });

    try {
      await batch.commit();
      toast({
        variant: 'success',
        title: 'Status Updated',
        description: `Room ${room.roomNumber} is now marked as "${newStatus}".`,
      });
    } catch (error) {
      console.error('Update status error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update status.',
      });
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <TopHeader name="Do Not Disturb" icon={<BellOff className="h-10 w-10" />} description="A real-time overview of all rooms with a 'Do Not Disturb' status." />

        {isLoading ? (
          <DoNotDisturbLoading />
        ) : dndRooms.length === 0 ? (
          <EmptyState
            icon={Bed}
            title="All Rooms Are Available"
            description="No rooms are currently marked as 'Do Not Disturb'."
            className="min-h-[50vh]"
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {dndRooms.map((item) => (
              <DndCard
                key={item.roomNumber}
                item={item}
                onUpdateStatus={handleUpdateStatus}
                onViewDetails={setSelectedBooking}
              />
            ))}
          </div>
        )}
      </div>
      <BookingDetailsDialog
        open={!!selectedBooking}
        onOpenChange={() => setSelectedBooking(null)}
        booking={selectedBooking}
      />
    </>
  );
}

export default withAuth(DoNotDisturbPage, PagePermission.MANAGE_ROOM_STATUS);
