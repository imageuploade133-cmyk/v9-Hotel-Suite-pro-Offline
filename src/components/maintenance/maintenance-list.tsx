'use client';

import * as React from 'react';
import {
  collection,
  query,
  doc,
  writeBatch,
  onSnapshot,
  orderBy,
  getDocs,
  where,
  limit,
  increment,
} from 'firebase/firestore';
import type {
  Booking,
  Room,
  MaintenanceQueueItem,
  MaintenanceItemWithData,
} from '@/lib/types';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Wrench } from 'lucide-react';
import { MaintenanceCard } from './maintenance-card';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import { Separator } from '../ui/separator';

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="flex flex-col">
          <CardHeader>
            <Skeleton className="h-7 w-28" />
          </CardHeader>
          <CardContent className="flex-grow space-y-4">
            <Skeleton className="h-6 w-full" />
            <Separator />
            <div className="space-y-3">
              <Skeleton className="h-4 w-20" />
              <div className="flex w-full items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 flex-1" />
            </div>
          </CardContent>
          <CardFooter className="p-2">
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export function MaintenanceList() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [maintenanceQueue, setMaintenanceQueue] = React.useState<
    MaintenanceItemWithData[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(
    null
  );

  React.useEffect(() => {
    if (!firestore) return;

    setIsLoading(true);

    const q = query(
      collection(firestore, 'maintenance-queue'),
      orderBy('reportedAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (querySnapshot) => {
        const queue: MaintenanceItem[] = [];
        querySnapshot.forEach((doc) => {
          queue.push({ id: doc.id, ...doc.data() } as MaintenanceItem);
        });

        const roomsMap = new Map<string, Room>();
        const roomTypeIds = Array.from(new Set(queue.map((item) => item.roomId)));
        if (roomTypeIds.length > 0) {
            const roomTypesQuery = query(collection(firestore, 'rooms'), where('__name__', 'in', roomTypeIds));
            const roomTypesSnapshot = await getDocs(roomTypesQuery);
            roomTypesSnapshot.forEach(doc => roomsMap.set(doc.id, { id: doc.id, ...doc.data() } as Room));
        }

        const bookingsMap = new Map<string, Booking>();
        const bookingIds = queue.map((item) => item.bookingId).filter(Boolean) as string[];
        if (bookingIds.length > 0) {
            const bookingsQuery = query(collection(firestore, 'bookings'), where('__name__', 'in', bookingIds));
            const bookingsSnapshot = await getDocs(bookingsQuery);
            bookingsSnapshot.forEach(doc => bookingsMap.set(doc.id, { id: doc.id, ...doc.data() } as Booking));
        }

        const queueWithRoomData = queue.map((item) => ({
          ...item,
          roomType: roomsMap.get(item.roomId) || null,
          booking: item.bookingId ? bookingsMap.get(item.bookingId) || null : null,
        }));

        setMaintenanceQueue(queueWithRoomData);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching maintenance queue:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not fetch rooms needing maintenance.',
        });
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, toast]);

  const handleConfirmUpdateStatus = async (
    room: { id: string; roomNumber: string },
    status: string
  ) => {
    if (!firestore) return;

    const batch = writeBatch(firestore);

    const roomTypeRef = doc(firestore, 'rooms', room.id);

    batch.update(roomTypeRef, {
        [`individualRoomStatus.${room.roomNumber}`]: status === 'Vacant' ? null : status,
    });

    // Only adjust counts if moving from an occupied to a vacant state
    if (status === 'Vacant') {
        batch.update(roomTypeRef, { availableRooms: increment(1), bookedRooms: increment(-1) });
    }

    const maintenanceQuery = query(
      collection(firestore, 'maintenance-queue'),
      where('roomNumber', '==', room.roomNumber),
      limit(1)
    );
    const maintenanceSnapshot = await getDocs(maintenanceQuery);
    maintenanceSnapshot.forEach((doc) => batch.delete(doc.ref));

    try {
      await batch.commit();
      toast({
        variant: 'success',
        title: 'Status Updated',
        description: `Room ${room.roomNumber} is now marked as "${status}".`,
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
      {isLoading ? (
        <LoadingSkeleton />
      ) : maintenanceQueue.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No Rooms Need Maintenance"
          description="All rooms are currently in good condition."
          className="min-h-[50vh]"
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {maintenanceQueue.map((item) => (
            <MaintenanceCard
              key={item.id}
              item={item}
              onConfirm={handleConfirmUpdateStatus}
              onViewDetails={setSelectedBooking}
            />
          ))}
        </div>
      )}
      <BookingDetailsDialog
        open={!!selectedBooking}
        onOpenChange={() => setSelectedBooking(null)}
        booking={selectedBooking}
      />
    </>
  );
}
