
'use client';

import { useSettings } from '@/contexts/settings-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useMemo } from 'react';

export const useGetStartedSteps = () => {
    const { settings, isLoading: areSettingsLoading } = useSettings();
    const firestore = useFirestore();

    const roomsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'rooms'));
    }, [firestore]);
    const { data: rooms, isLoading: areRoomsLoading } = useCollection(roomsQuery);

    const staffQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);
    const { data: staff, isLoading: areStaffLoading } = useCollection(staffQuery);

    const bookingsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'bookings'));
    }, [firestore]);
    const { data: bookings, isLoading: areBookingsLoading } = useCollection(bookingsQuery);

    const isLoading = areSettingsLoading || areRoomsLoading || areStaffLoading || areBookingsLoading;

    const steps = useMemo(() => [
        {
            id: 'customize',
            title: 'Customize Your Hotel',
            description: 'Add your hotel name, logo, and currency.',
            isCompleted: !!settings?.businessName,
            href: '/settings'
        },
        {
            id: 'add-rooms',
            title: 'Add Your First Room',
            description: 'Create a room type to start taking bookings.',
            isCompleted: (rooms?.length || 0) > 0,
            href: '/rooms'
        },
        {
            id: 'add-staff',
            title: 'Add a Staff Member',
            description: 'Create accounts for your team members.',
            isCompleted: (staff?.length || 0) > 1, // At least one besides the admin
            href: '/staff'
        },
        {
            id: 'first-booking',
            title: 'Make Your First Booking',
            description: 'Try creating a reservation or a walk-in check-in.',
            isCompleted: (bookings?.length || 0) > 0,
            href: '/bookings'
        }
    ], [settings, rooms, staff, bookings]);

    const completedCount = useMemo(() => steps.filter(step => step.isCompleted).length, [steps]);
    const allStepsCompleted = completedCount === steps.length;

    return { steps, completedCount, allStepsCompleted, isLoading };
};
