'use client';

import * as React from 'react';
import {
  collection,
  query,
  doc,
  increment,
  onSnapshot,
  writeBatch,
  getDocs,
  where,
  limit,
  orderBy,
} from 'firebase/firestore';
import {
  Wind,
  Bed,
} from 'lucide-react';
import type { Booking, Room, CleaningQueueItem } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { CleaningCard } from '@/components/cleaning/cleaning-card';
import { TopHeader } from '@/components/top-header';
import CleaningLoading from './loading';

interface CleaningItemWithData extends CleaningQueueItem {
  roomType: Room | null;
  booking: Booking | null;
}

function CleaningInProgressPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [cleaningQueue, setCleaningQueue] = React.useState<CleaningItemWithData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(null);


  React.useEffect(() => {
    if (!firestore) return;

    setIsLoading(true);

    const q = query(collection(firestore, 'cleaning-queue'), orderBy('checkedOutAt', 'asc'));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const queue: CleaningQueueItem[] = [];
        querySnapshot.forEach((doc) => {
            queue.push({ id: doc.id, ...doc.data() } as CleaningQueueItem);
        });

        // Fetch room type details for each item
        const roomsMap = new Map<string, Room>();
        const roomTypeIds = Array.from(new Set(queue.map(item => item.roomId)));

        if(roomTypeIds.length > 0) {
            const roomTypesQuery = query(collection(firestore, 'rooms'), where('__name__', 'in', roomTypeIds));
            const roomTypesSnapshot = await getDocs(roomTypesQuery);
            roomTypesSnapshot.forEach(doc => roomsMap.set(doc.id, { id: doc.id, ...doc.data() } as Room));
        }

        const queueWithRoomData = queue.map(item => ({
            ...item,
            roomType: roomsMap.get(item.roomId) || null,
            booking: (item as any).lastGuestBookingDetails || null,
        }));

        setCleaningQueue(queueWithRoomData);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching cleaning queue:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not fetch rooms needing cleaning.",
        });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, toast]);


  const handleConfirmUpdateStatus = async (room: { id: string, roomNumber: string }, status: string) => {
    if (!firestore) return;

    const batch = writeBatch(firestore);

    const roomTypeRef = doc(firestore, 'rooms', room.id);

    // Always update the individual status map
    batch.update(roomTypeRef, {
        [`individualRoomStatus.${room.roomNumber}`]: status === 'Vacant' ? null : status,
    });

    // If status is now Vacant, it's fixed.
    if (status === 'Vacant') {
        batch.update(roomTypeRef, { availableRooms: increment(1) });
    }

    // Remove from the cleaning queue regardless of new status
    const cleaningQuery = query(collection(firestore, 'cleaning-queue'), where('roomNumber', '==', room.roomNumber), limit(1));
    const cleaningSnapshot = await getDocs(cleaningQuery);
    cleaningSnapshot.forEach(doc => batch.delete(doc.ref));

    try {
      await batch.commit();
      toast({
        variant: 'success',
        title: 'Status Updated',
        description: `Room ${room.roomNumber} is now marked as "${status}".`,
      });
    } catch (error) {
      console.error('Update status error:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update status.' });
    }
  };

  return (
    <>
        <div className="flex flex-col gap-6">
          <TopHeader name="Cleaning In Progress" icon={<Wind />} description="A real-time list of rooms that have been checked out and need cleaning." />

        {isLoading ? (
            <CleaningLoading />
        ) : cleaningQueue.length === 0 ? (
            <EmptyState
            icon={Bed}
            title="All Rooms Are Ready"
            description="There are currently no rooms that need cleaning."
            className="min-h-[50vh]"
            />
        ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cleaningQueue.map(item => (
                <CleaningCard
                key={item.id}
                item={item}
                onConfirm={handleConfirmUpdateStatus}
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


export default withAuth(CleaningInProgressPage, PagePermission.VIEW_CLEANING_PAGE);
