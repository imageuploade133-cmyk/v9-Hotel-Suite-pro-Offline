
'use client';

import { useMemo, useCallback } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, collectionGroup } from 'firebase/firestore';
import type { Booking, Room, Payment, Bill, CleaningQueueItem, MaintenanceQueueItem, StockReturn, SalonService, LaundryOrder, Order, StockSale } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { setSeconds, setMinutes, setHours, isToday, startOfDay, endOfDay } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { useUser } from '@/contexts/user-context';

const FETCH_OPTS = { realtime: false, cache: false } as const;

export const useBookings = () => {
    const firestore = useFirestore();
    const { userProfile } = useUser();
    const { settings } = useSettings();
    const checkoutTime = settings?.checkoutTime || '11:00';

    const roomsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'rooms'), orderBy('name')) : null, [firestore]);
    const allBookingsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'bookings'), orderBy('checkInDate', 'asc')) : null, [firestore]);
    const additionalPaymentsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'payments')) : null, [firestore]);
    const allBillsQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'bills')) : null, [firestore]);
    const cleaningQueueQuery = useMemoFirebase(() => firestore ? collection(firestore, 'cleaning-queue') : null, [firestore]);
    const maintenanceQueueQuery = useMemoFirebase(() => firestore ? collection(firestore, 'maintenance-queue') : null, [firestore]);
    const stockReturnsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'stockReturns')) : null, [firestore]);
    const salonServicesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'salonServices')) : null, [firestore]);
    const laundryOrdersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'laundry')) : null, [firestore]);
    const kitchenOrdersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'orders')) : null, [firestore]);
    const activeBookingsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'bookings'), where('status', 'in', ['Active', 'Checked-in'])) : null, [firestore]);
    const salesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'stockSales')) : null, [firestore]);

    const { data: rooms, isLoading: areRoomsLoading, refetch: refetchRooms } = useCollection<Room>(roomsQuery, FETCH_OPTS);
    const { data: allBookings, isLoading: areBookingsLoading, refetch: refetchAllBookings } = useCollection<Booking>(allBookingsQuery, FETCH_OPTS);
    const { data: additionalPaymentsData, isLoading: additionalPaymentsLoading, refetch: refetchPayments } = useCollection<Payment>(additionalPaymentsQuery, FETCH_OPTS);
    const { data: allBillsData, isLoading: areBillsLoading, refetch: refetchBills } = useCollection<Bill>(allBillsQuery, FETCH_OPTS);
    const { data: cleaningQueueData, refetch: refetchCleaning } = useCollection<CleaningQueueItem>(cleaningQueueQuery, FETCH_OPTS);
    const { data: maintenanceQueueData, refetch: refetchMaintenance } = useCollection<MaintenanceQueueItem>(maintenanceQueueQuery, FETCH_OPTS);
    const { data: stockReturnsData, isLoading: areStockReturnsLoading, refetch: refetchStockReturns } = useCollection<StockReturn>(stockReturnsQuery, FETCH_OPTS);
    const { data: salonServicesData, isLoading: areSalonServicesLoading, refetch: refetchSalon } = useCollection<SalonService>(salonServicesQuery, FETCH_OPTS);
    const { data: laundryOrdersData, isLoading: areLaundryOrdersLoading, refetch: refetchLaundry } = useCollection<LaundryOrder>(laundryOrdersQuery, FETCH_OPTS);
    const { data: kitchenOrdersData, isLoading: areKitchenOrdersLoading, refetch: refetchKitchen } = useCollection<Order>(kitchenOrdersQuery, FETCH_OPTS);
    const { data: activeBookings, refetch: refetchActiveBookings } = useCollection<Booking>(activeBookingsQuery, FETCH_OPTS);
    const { data: salesData, isLoading: areSalesLoading, refetch: refetchSales } = useCollection<StockSale>(salesQuery, FETCH_OPTS);

    const overdueCheckoutsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        const [hours, minutes] = checkoutTime.split(':').map(Number);
        const overdueDeadline = setSeconds(setMinutes(setHours(new Date(), hours), minutes), 0);
        return query(
            collection(firestore, 'bookings'),
            where('status', 'in', ['Active', 'Checked-in']),
            where('checkOutDate', '<=', overdueDeadline)
        );
    }, [firestore, checkoutTime]);
    const { data: overdueCheckoutsData, isLoading: areOverdueCheckoutsLoading, refetch: refetchOverdue } = useCollection<Booking>(overdueCheckoutsQuery, FETCH_OPTS);

    const isLoading = areRoomsLoading || areBookingsLoading || areOverdueCheckoutsLoading || additionalPaymentsLoading || areBillsLoading || areStockReturnsLoading || areSalonServicesLoading || areLaundryOrdersLoading || areKitchenOrdersLoading || areSalesLoading;

    const reload = useCallback(() => {
        refetchRooms();
        refetchAllBookings();
        refetchPayments();
        refetchBills();
        refetchCleaning();
        refetchMaintenance();
        refetchStockReturns();
        refetchSalon();
        refetchLaundry();
        refetchKitchen();
        refetchActiveBookings();
        refetchSales();
        refetchOverdue();
    }, [refetchRooms, refetchAllBookings, refetchPayments, refetchBills, refetchCleaning, refetchMaintenance, refetchStockReturns, refetchSalon, refetchLaundry, refetchKitchen, refetchActiveBookings, refetchSales, refetchOverdue]);

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

        // Calculate today's bookings created by this user
        const myTodaysBookings = (allBookings || [])
          .filter(b =>
            b.createdByUid === userProfile.uid &&
            getSafeDate(b.createdAt) && isToday(getSafeDate(b.createdAt)!)
          )
          .reduce((sum, b) => {
            // Get refunds for this booking
            const bookingRefunds = (stockReturnsData || [])
              .filter(r => r.originalBookingId === b.id)
              .reduce((refSum, r) => refSum + r.totalRefundAmount, 0);

            return sum + ((b.totalAmount || 0) - bookingRefunds);
          }, 0);

        // Calculate today's sales made by this user
        const myTodaysSales = (salesData || [])
          .filter(s =>
            s.soldByUid === userProfile.uid &&
            getSafeDate(s.soldAt) && isToday(getSafeDate(s.soldAt)!)
          )
          .reduce((sum, s) => {
            // Get refunds for this sale
            const saleRefunds = (stockReturnsData || [])
              .filter(r => r.originalSaleId === s.id)
              .reduce((refSum, r) => refSum + r.totalRefundAmount, 0);

            return sum + (s.totalAmount - saleRefunds);
          }, 0);

        return myTodaysBookings + myTodaysSales;

    }, [allBookings, salesData, stockReturnsData, userProfile]);

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
        reload,
        reloadBookings: reload,
    };
};
