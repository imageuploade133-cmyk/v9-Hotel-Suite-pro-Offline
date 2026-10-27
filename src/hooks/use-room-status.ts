
'use client';

import { useMemo, useCallback } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Booking, IndividualRoom, Room, CleaningQueueItem, MaintenanceQueueItem } from '@/lib/types';
import { getSafeDate } from '@/lib/helpers';

const REALTIME_OPTS = { realtime: true, cache: false } as const;
const ONE_TIME_OPTS = { realtime: false, cache: false } as const;

export const useRoomStatus = () => {
    const firestore = useFirestore();

    const allRoomsQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'rooms'));
    }, [firestore]);
    const { data: allRoomsData, isLoading: areRoomsLoading } = useCollection<Room>(allRoomsQuery, REALTIME_OPTS);

    const allBookingsQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'bookings'));
    }, [firestore]);
    const { data: allBookingsData, isLoading: areBookingsLoading } = useCollection<Booking>(allBookingsQuery, ONE_TIME_OPTS);

    const cleaningQueueQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'cleaning-queue'));
    }, [firestore]);
    const { data: cleaningQueueData } = useCollection<CleaningQueueItem>(cleaningQueueQuery, ONE_TIME_OPTS);

    const maintenanceQueueQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'maintenance-queue'));
    }, [firestore]);
    const { data: maintenanceQueueData } = useCollection<MaintenanceQueueItem>(maintenanceQueueQuery, ONE_TIME_OPTS);

    const roomStatusesQuery = useMemo(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'roomStatuses'));
    }, [firestore]);
    const { data: roomStatusesData } = useCollection(roomStatusesQuery, REALTIME_OPTS);


    const isLoading = areRoomsLoading || areBookingsLoading;

    const reload = useCallback(() => {
        // Real-time subscriptions update automatically, no manual refetch needed
    }, []);

    const { individualRoomsByStatus, reservationsByRoom } = useMemo(() => {
        const statusMap: { [key: string]: IndividualRoom[] } = {};
        const reservationsMap: { [key: string]: Booking[] } = {};

        const allStatusNames = new Set(['Vacant', 'Active Check-ins', 'Reserved', 'Cleaning in Progress', 'Maintenance', 'Do Not Disturb']);
        roomStatusesData?.forEach((status: any) => allStatusNames.add(status.name));
        allStatusNames.forEach(name => {
          statusMap[name] = [];
        });

        if (allRoomsData && allBookingsData) {
            allRoomsData.forEach(roomType => {
                roomType.roomNumbers?.forEach(roomNumber => {

                    const currentBooking = allBookingsData.find(b =>
                        b.roomNumber === roomNumber &&
                        (b.status === 'Active' || b.status === 'Checked-in')
                    );

                    const reservations = allBookingsData.filter(b =>
                        b.roomNumber === roomNumber &&
                        (b.status === 'Booked' || b.status === 'Reserved')
                    );

                    if (reservations.length > 0) {
                      reservationsMap[roomNumber] = reservations;
                    }

                    const cleaningItem = cleaningQueueData?.find(item => item.roomNumber === roomNumber);
                    const maintenanceItem = maintenanceQueueData?.find(item => item.roomNumber === roomNumber);

                    let status = 'Vacant';
                    if (currentBooking) {
                        status = 'Active Check-ins';
                    } else if (reservations.length > 0) {
                        status = 'Reserved';
                    } else if (roomType.individualRoomStatus?.[roomNumber]) {
                        status = roomType.individualRoomStatus[roomNumber]!;
                    }

                    const statusMapKeys = Object.keys(statusMap);
                    const canonicalStatus = statusMapKeys.find(key => key.toLowerCase() === status.toLowerCase()) || status;

                    const individualRoom: IndividualRoom = {
                        id: roomType.id,
                        roomNumber,
                        name: roomType.name,
                        price: roomType.price,
                        facilities: roomType.facilities,
                        status: canonicalStatus,
                        currentBooking,
                        reservations,
                        cleaningQueueItem: cleaningItem,
                        maintenanceQueueItem: maintenanceItem,
                        statusMeta: roomType.individualRoomStatus?.[roomNumber] ? {
                            markedBy: "Staff",
                            markedAt: getSafeDate(new Date())!
                        } : undefined,
                    };

                    if (statusMap[canonicalStatus]) {
                        statusMap[canonicalStatus].push(individualRoom);
                    } else {
                        statusMap[canonicalStatus] = [individualRoom];
                    }
                });
            });
        }

        return { individualRoomsByStatus: statusMap, reservationsByRoom: reservationsMap };
    }, [allRoomsData, allBookingsData, cleaningQueueData, maintenanceQueueData, roomStatusesData]);


    return { individualRoomsByStatus, allRoomsData, allBookingsData, reservationsByRoom, roomStatusesData, isLoading, reload };
};
