'use client';

import { useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, where, collectionGroup } from 'firebase/firestore';
import type { Booking, Room, Payment, Bill, CleaningQueueItem, MaintenanceQueueItem, StockReturn, SalonService, LaundryOrder, Order, StockSale } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { setSeconds, setMinutes, setHours, isToday, startOfDay, endOfDay } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { useUser } from '@/contexts/user-context';
import { useCachedCollection, CacheTTL, CacheKeys } from './use-cached-firestore';

/**
 * Cached version of useBookings hook
 *
 * This hook uses the Firestore cache system to minimize reads while
 * still providing real-time updates for critical data.
 */
export const useCachedBookings = () => {
    const firestore = useFirestore();
    const { userProfile } = useUser();
    const { settings } = useSettings();
    const checkoutTime = settings?.checkoutTime || '11:00';

    // Static/rarely changing data - longer cache, no realtime
    const roomsQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'rooms'), orderBy('name')) : null,
        [firestore]
    );
    const salonServicesQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'salonServices')) : null,
        [firestore]
    );

    // Semi-static data - medium cache with realtime updates
    const stockReturnsQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'stockReturns')) : null,
        [firestore]
    );
    const laundryOrdersQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'laundry')) : null,
        [firestore]
    );

    // Frequently changing data - short cache with realtime updates
    const bookingsQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'bookings'), orderBy('checkInDate', 'asc')) : null,
        [firestore]
    );
    const activeBookingsQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'bookings'), where('status', 'in', ['Active', 'Checked-in'])) : null,
        [firestore]
    );
    const paymentsQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'payments')) : null,
        [firestore]
    );
    const salesQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'stockSales')) : null,
        [firestore]
    );

    // Operational queues - very short cache, always realtime
    const cleaningQueueQuery = useMemo(() =>
        firestore ? collection(firestore, 'cleaning-queue') : null,
        [firestore]
    );
    const maintenanceQueueQuery = useMemo(() =>
        firestore ? collection(firestore, 'maintenance-queue') : null,
        [firestore]
    );
    const kitchenOrdersQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'orders')) : null,
        [firestore]
    );
    const billsQuery = useMemo(() =>
        firestore ? query(collectionGroup(firestore, 'bills')) : null,
        [firestore]
    );

    // Overdue checkouts query
    const overdueCheckoutsQuery = useMemo(() => {
        if (!firestore) return null;
        const [hours, minutes] = checkoutTime.split(':').map(Number);
        const overdueDeadline = setSeconds(setMinutes(setHours(new Date(), hours), minutes), 0);
        return query(
            collection(firestore, 'bookings'),
            where('status', 'in', ['Active', 'Checked-in']),
            where('checkOutDate', '<=', overdueDeadline)
        );
    }, [firestore, checkoutTime]);

    // Fetch with appropriate caching strategies
    // Rooms - static, long cache, no realtime needed
    const { data: rooms, isLoading: areRoomsLoading } = useCachedCollection<Room>(roomsQuery, {
        ttl: CacheTTL.HOUR,
        realtime: false,
        staleWhileRevalidate: false,
        cacheKey: CacheKeys.collection('rooms'),
    });

    // Bookings - frequently changing, short cache with realtime
    const { data: allBookings, isLoading: areBookingsLoading } = useCachedCollection<Booking>(bookingsQuery, {
        ttl: CacheTTL.SHORT,
        realtime: true,
        staleWhileRevalidate: false,
        cacheKey: CacheKeys.collection('bookings'),
    });

    // Active bookings - critical for operations, realtime only
    const { data: activeBookings } = useCachedCollection<Booking>(activeBookingsQuery, {
        ttl: CacheTTL.SHORT,
        realtime: true,
        staleWhileRevalidate: false,
        cacheKey: CacheKeys.collection('active-bookings'),
    });

    // Payments - frequently accessed, medium cache with realtime
    const { data: additionalPaymentsData, isLoading: additionalPaymentsLoading } = useCachedCollection<Payment>(paymentsQuery, {
        ttl: CacheTTL.MEDIUM,
        realtime: true,
        staleWhileRevalidate: false,
        cacheKey: CacheKeys.collection('payments'),
    });

    // Bills - medium cache with realtime
    const { data: allBillsData, isLoading: areBillsLoading } = useCachedCollection<Bill>(billsQuery, {
        ttl: CacheTTL.MEDIUM,
        realtime: true,
        staleWhileRevalidate: false,
        cacheKey: CacheKeys.collection('bills'),
    });

    // Cleaning queue - operational, short cache with realtime
    const { data: cleaningQueueData } = useCachedCollection<CleaningQueueItem>(cleaningQueueQuery, {
        ttl: CacheTTL.SHORT,
        realtime: true,
        staleWhileRevalidate: false,
        cacheKey: CacheKeys.collection('cleaning-queue'),
    });

    // Maintenance queue - operational, short cache with realtime
    const { data: maintenanceQueueData } = useCachedCollection<MaintenanceQueueItem>(maintenanceQueueQuery, {
        ttl: CacheTTL.SHORT,
        realtime: true,
        staleWhileRevalidate: false,
        cacheKey: CacheKeys.collection('maintenance-queue'),
    });

    // Kitchen orders - operational, short cache with realtime
    const { data: kitchenOrdersData, isLoading: areKitchenOrdersLoading } = useCachedCollection<Order>(kitchenOrdersQuery, {
        ttl: CacheTTL.SHORT,
        realtime: true,
        staleWhileRevalidate: false,
        cacheKey: CacheKeys.collection('orders'),
    });

    // Stock returns - less frequent access, longer cache
    const { data: stockReturnsData, isLoading: areStockReturnsLoading } = useCachedCollection<StockReturn>(stockReturnsQuery, {
        ttl: CacheTTL.MEDIUM,
        realtime: true,
        staleWhileRevalidate: false,
        cacheKey: CacheKeys.collection('stockReturns'),
    });

    // Salon services - rarely changes, long cache
    const { data: salonServicesData, isLoading: areSalonServicesLoading } = useCachedCollection<SalonService>(salonServicesQuery, {
        ttl: CacheTTL.LONG,
        realtime: false,
        staleWhileRevalidate: false,
        cacheKey: CacheKeys.collection('salonServices'),
    });

    // Laundry orders - medium cache with realtime
    const { data: laundryOrdersData, isLoading: areLaundryOrdersLoading } = useCachedCollection<LaundryOrder>(laundryOrdersQuery, {
        ttl: CacheTTL.MEDIUM,
        realtime: true,
        staleWhileRevalidate: false,
        cacheKey: CacheKeys.collection('laundry'),
    });

    // Sales - medium cache with realtime
    const { data: salesData, isLoading: areSalesLoading } = useCachedCollection<StockSale>(salesQuery, {
        ttl: CacheTTL.MEDIUM,
        realtime: true,
        staleWhileRevalidate: false,
        cacheKey: CacheKeys.collection('stockSales'),
    });

    // Overdue checkouts - operational, short cache with realtime
    const { data: overdueCheckoutsData, isLoading: areOverdueCheckoutsLoading } = useCachedCollection<Booking>(overdueCheckoutsQuery, {
        ttl: CacheTTL.SHORT,
        realtime: true,
        staleWhileRevalidate: false,
        cacheKey: CacheKeys.collection('overdue-checkouts'),
    });

    const isLoading = areRoomsLoading || areBookingsLoading || areOverdueCheckoutsLoading ||
                      additionalPaymentsLoading || areBillsLoading || areStockReturnsLoading ||
                      areSalonServicesLoading || areLaundryOrdersLoading || areKitchenOrdersLoading || areSalesLoading;

    // Computed values
    const { todaysIncome, totalRefunds } = useMemo(() => {
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        const todaysPayments = (additionalPaymentsData || []).filter(p => {
            const pDate = getSafeDate(p.transactionDate);
            return pDate && pDate >= todayStart && pDate <= todayEnd;
        });

        const income = todaysPayments
            .filter(p => p.status === 'Paid')
            .reduce((sum, p) => sum + p.amount, 0);

        const refunds = todaysPayments
            .filter(p => p.status === 'Refunded')
            .reduce((sum, p) => sum + p.amount, 0);

        return { todaysIncome: income, totalRefunds: refunds };
    }, [additionalPaymentsData]);

    const myTodaysIncome = useMemo(() => {
        if (!userProfile) return 0;
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        const myTodaysPaidBookings = (allBookings || [])
            .filter(b =>
                b.createdByUid === userProfile.uid &&
                (b.status === 'Reserved' || b.status === 'Active' || b.status === 'Checked-in') &&
                getSafeDate(b.createdAt) && isToday(getSafeDate(b.createdAt)!)
            )
            .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

        const myTodaysSales = (salesData || [])
            .filter(s =>
                s.soldByUid === userProfile.uid &&
                s.paymentStatus === 'Paid' &&
                getSafeDate(s.soldAt) && isToday(getSafeDate(s.soldAt)!)
            )
            .reduce((sum, s) => sum + s.totalAmount, 0);

        return myTodaysPaidBookings + myTodaysSales;
    }, [allBookings, salesData, userProfile]);

    return {
        rooms,
        allBookings,
        allBookingsData: allBookings,
        additionalPaymentsData,
        allBillsData,
        cleaningQueueData,
        maintenanceQueueData,
        overdueCheckoutsData,
        stockReturnsData,
        salonServicesData,
        laundryOrdersData,
        kitchenOrdersData,
        todaysIncome,
        totalRefunds,
        myTodaysIncome,
        activeBookings,
        isLoading,
    };
};
