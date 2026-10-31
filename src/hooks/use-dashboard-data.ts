'use client';

import * as React from 'react';
import { useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, onSnapshot, Unsubscribe, collectionGroup } from 'firebase/firestore';
import type { Booking, Order, Room, StockItem, Expense, Payment, StockSale, StockReturn, Bill } from '@/lib/types';
import { getSafeDate } from '@/lib/helpers';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, format, differenceInDays, isWithinInterval, isToday } from 'date-fns';
import { useSettings } from '@/contexts/settings-context';
import { useUser } from '@/contexts/user-context';
import { useBranch } from '@/contexts/branch-context';

interface UseDashboardDataProps {
    dateRange?: { from?: Date; to?: Date };
    incomeFilter: 'today' | 'yesterday' | 'lastWeek' | 'custom';
    posIncomeFilter: 'today' | 'yesterday' | 'lastWeek';
    monthlyIncomeFilter: string;
    yearlyIncomeFilter: string;
}

export const useDashboardData = ({ dateRange, incomeFilter, posIncomeFilter, monthlyIncomeFilter, yearlyIncomeFilter }: UseDashboardDataProps) => {
    const firestore = useFirestore();
    const { getCollectionPath } = useBranch();
    const [data, setData] = React.useState<{
        bookings: Booking[];
        rooms: Room[];
        orders: Order[];
        stockItems: StockItem[];
        expenses: Expense[];
        payments: Payment[];
        sales: StockSale[];
        stockReturns: StockReturn[];
        bills: Bill[];
    } | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

    // Real-time subscriptions for financial data - NO CACHING
    React.useEffect(() => {
        if (!firestore) return;

        setIsLoading(true);
        const unsubscribers: Unsubscribe[] = [];

        // Subscribe to all collections with real-time updates
        const collections = [
            { name: 'bookings', setter: (docs: Booking[]) => setData(prev => prev ? { ...prev, bookings: docs } : { bookings: docs, rooms: [], orders: [], stockItems: [], expenses: [], payments: [], sales: [], stockReturns: [], bills: [] }) },
            { name: 'rooms', setter: (docs: Room[]) => setData(prev => prev ? { ...prev, rooms: docs } : { bookings: [], rooms: docs, orders: [], stockItems: [], expenses: [], payments: [], sales: [], stockReturns: [], bills: [] }) },
            { name: 'orders', setter: (docs: Order[]) => setData(prev => prev ? { ...prev, orders: docs } : { bookings: [], rooms: [], orders: docs, stockItems: [], expenses: [], payments: [], sales: [], stockReturns: [], bills: [] }) },
            { name: getCollectionPath('stock'), setter: (docs: StockItem[]) => setData(prev => prev ? { ...prev, stockItems: docs } : { bookings: [], rooms: [], orders: [], stockItems: docs, expenses: [], payments: [], sales: [], stockReturns: [], bills: [] }) },
            { name: 'expenses', setter: (docs: Expense[]) => setData(prev => prev ? { ...prev, expenses: docs } : { bookings: [], rooms: [], orders: [], stockItems: [], expenses: docs, payments: [], sales: [], stockReturns: [], bills: [] }) },
            { name: 'payments', setter: (docs: Payment[]) => setData(prev => prev ? { ...prev, payments: docs } : { bookings: [], rooms: [], orders: [], stockItems: [], expenses: [], payments: docs, sales: [], stockReturns: [], bills: [] }) },
            { name: getCollectionPath('stockSales'), setter: (docs: StockSale[]) => setData(prev => prev ? { ...prev, sales: docs } : { bookings: [], rooms: [], orders: [], stockItems: [], expenses: [], payments: [], sales: docs, stockReturns: [], bills: [] }) },
            { name: getCollectionPath('stockReturns'), setter: (docs: StockReturn[]) => setData(prev => prev ? { ...prev, stockReturns: docs } : { bookings: [], rooms: [], orders: [], stockItems: [], expenses: [], payments: [], sales: [], stockReturns: docs, bills: [] }) },
        ];

        // Immediately populate from Local Master LAN Store (/api/lan-sync) for 100% offline support
        collections.forEach(async ({ name, setter }) => {
            try {
                const res = await fetch(`/api/lan-sync?collection=${encodeURIComponent(name)}`);
                if (res.ok) {
                    const result = await res.json();
                    if (result.data) {
                        const docs = Object.entries(result.data).map(([id, val]: [string, any]) => ({
                            id,
                            ...(typeof val === 'object' ? val : {}),
                        }));
                        if (docs.length > 0) {
                            setter(docs as any);
                            setIsLoading(false);
                        }
                    }
                }
            } catch {}
        });

        // Subscribe to bills collection group
        try {
            const billsQuery = query(collectionGroup(firestore, 'bills'));
            const billsUnsubscribe = onSnapshot(
                billsQuery,
                (snapshot) => {
                    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bill));
                    setData(prev => prev ? { ...prev, bills: docs } : { bookings: [], rooms: [], orders: [], stockItems: [], expenses: [], payments: [], sales: [], stockReturns: [], bills: docs });
                    setIsLoading(false);
                    setError(null);
                },
                (err) => {
                    console.error('Error subscribing to bills:', err);
                    setIsLoading(false);
                }
            );
            unsubscribers.push(billsUnsubscribe);
        } catch {
            setIsLoading(false);
        }

        collections.forEach(({ name, setter }) => {
            try {
                const q = query(collection(firestore, name));
                const unsubscribe = onSnapshot(
                    q,
                    (snapshot) => {
                        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
                        setter(docs);
                        setIsLoading(false);
                        setError(null);
                    },
                    (err) => {
                        console.error(`Error subscribing to ${name}:`, err);
                        setIsLoading(false);
                    }
                );
                unsubscribers.push(unsubscribe);
            } catch {
                setIsLoading(false);
            }
        });

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [firestore, getCollectionPath]);

    const { userProfile } = useUser();
    const { settings } = useSettings();

    const memoizedData = useMemo(() => {
        const defaultReturn = {
            data: null, metrics: [], stockMetrics: [], totalStockProfit: 0,
            filteredIncome: 0, filteredIncomeLabel: '...', grandTotalIncome: 0,
            filteredMonthlyIncome: 0, filteredMonthlyIncomeLabel: '...', allMonths: [],
            filteredYearlyIncome: 0, filteredYearlyIncomeLabel: '...', allYears: [],
            netProfit: 0, totalExpenses: 0, totalInventoryValue: 0, netIncomeByMethod: {},
            totalOutstanding: 0, topSellingItems: [], weeklyOccupancyData: [],
            weeklyIncomeData: [], recentPaidBookings: [], recentReservations: [],
            recentCancellations: [], myTotalIncome: 0, myTodaysIncome: 0, userCurrency: 'USD',
            totalDiscount: 0, todaysDiscount: 0, discountsByStaff: [],
            totalRoomIncome: 0, totalRoomOutstanding: 0, totalReservations: 0, activeReservations: 0,
            todaysHotelPosIncome: 0, todaysMainPosIncome: 0, posIncomeLabel: "Today's POS Income",
            totalOutstandingBill: 0
        };

        if (!data) {
            return defaultReturn;
        }

        const {
            bookings = [],
            rooms = [],
            orders = [],
            stockItems = [],
            expenses = [],
            payments = [],
            sales = [],
            stockReturns = [],
            bills = []
        } = data;
        const userCurrency = settings?.currency || 'USD';

        const filterByDateRange = <T extends { createdAt?: any; transactionDate?: any; date?: any; soldAt?: any; cancelledAt?: any }>(items: T[] | undefined | null, startDate: Date, endDate: Date, dateField: keyof T) => {
            if (!items || !Array.isArray(items)) return [];
            return items.filter(item => {
                const itemDate = getSafeDate(item[dateField]);
                return itemDate && itemDate >= startDate && itemDate <= endDate;
            });
        };

        const filterPaymentsByDate = (paymentsToFilter: Payment[] | undefined | null, startDate: Date, endDate: Date) => {
            if (!paymentsToFilter || !Array.isArray(paymentsToFilter)) return [];
            return paymentsToFilter.filter(p => {
                const pDate = getSafeDate(p.transactionDate);
                return pDate && pDate >= startDate && pDate <= endDate;
            });
        };

        const filterReturnsByDate = (returnsToFilter: StockReturn[] | undefined | null, startDate: Date, endDate: Date) => {
            if (!returnsToFilter || !Array.isArray(returnsToFilter)) return [];
            return returnsToFilter.filter(r => {
                const rDate = getSafeDate(r.returnedAt);
                return rDate && rDate >= startDate && rDate <= endDate;
            });
        };

        const calculateIncome = (incomePayments: Payment[] | undefined | null) => {
            if (!incomePayments || !Array.isArray(incomePayments)) return 0;
            return incomePayments.reduce((acc, p) => {
                if (p.status === 'Paid') return acc + p.amount;
                return acc;
            }, 0);
        };

        let incomeRangeStart, incomeRangeEnd;
        let filteredIncomeLabel: string;
        const today = new Date();

        if (dateRange?.from) {
            incomeRangeStart = startOfDay(dateRange.from);
            incomeRangeEnd = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
            filteredIncomeLabel = `Custom Range`;
        } else {
            switch (incomeFilter) {
                case 'yesterday':
                    incomeRangeStart = startOfDay(subDays(today, 1));
                    incomeRangeEnd = endOfDay(subDays(today, 1));
                    filteredIncomeLabel = "Yesterday's Income";
                    break;
                case 'lastWeek':
                    incomeRangeStart = startOfDay(subDays(today, 6));
                    incomeRangeEnd = endOfDay(today);
                    filteredIncomeLabel = 'Last 7 Days';
                    break;
                default:
                    incomeRangeStart = startOfDay(today);
                    incomeRangeEnd = endOfDay(today);
                    filteredIncomeLabel = "Today's Income";
            }
        }

        let posIncomeRangeStart, posIncomeRangeEnd;
        let posIncomeLabel: string;

        switch (posIncomeFilter) {
            case 'yesterday':
                posIncomeRangeStart = startOfDay(subDays(today, 1));
                posIncomeRangeEnd = endOfDay(subDays(today, 1));
                posIncomeLabel = "Yesterday's POS Income";
                break;
            case 'lastWeek':
                posIncomeRangeStart = startOfDay(subDays(today, 6));
                posIncomeRangeEnd = endOfDay(today);
                posIncomeLabel = 'Last 7 Days';
                break;
            default:
                posIncomeRangeStart = startOfDay(today);
                posIncomeRangeEnd = endOfDay(today);
                posIncomeLabel = "Today's POS Income";
        }

        const filteredPosSales = filterByDateRange(sales, posIncomeRangeStart, posIncomeRangeEnd, 'soldAt');
        const filteredPosReturns = filterReturnsByDate(stockReturns, posIncomeRangeStart, posIncomeRangeEnd);

        const hotelPosRefunds = filteredPosReturns.reduce((sum, r) => {
            const originalSale = sales.find(s => s.id === r.originalSaleId);
            return originalSale?.context === 'hotel' ? sum + r.totalRefundAmount : sum;
        }, 0);
        const mainPosRefunds = filteredPosReturns.reduce((sum, r) => {
            const originalSale = sales.find(s => s.id === r.originalSaleId);
            return originalSale?.context !== 'hotel' ? sum + r.totalRefundAmount : sum;
        }, 0);

        const todaysHotelPosIncome = Math.max(0, filteredPosSales.filter(s => s.context === 'hotel').reduce((sum, sale) => sum + sale.totalAmount, 0) - hotelPosRefunds);
        const todaysMainPosIncome = Math.max(0, filteredPosSales.filter(s => s.context !== 'hotel').reduce((sum, sale) => sum + sale.totalAmount, 0) - mainPosRefunds);

        const filteredPayments = filterPaymentsByDate(payments, incomeRangeStart, incomeRangeEnd);
        const filteredExpenses = filterByDateRange(expenses, incomeRangeStart, incomeRangeEnd, 'date');
        const filteredSales = filterByDateRange(sales, incomeRangeStart, incomeRangeEnd, 'soldAt');
        const filteredIncome = calculateIncome(filteredPayments);

        const calculateDiscountAmount = (sale: StockSale) => {
          if (!sale.discountValue) return 0;
          const subtotal = (sale.items || []).reduce((acc, item) => acc + (item.sellingPrice * item.quantity), 0);
          return sale.discountType === 'percentage' ? (subtotal * sale.discountValue) / 100 : sale.discountValue;
        };
        const totalDiscount = filteredSales.reduce((acc, sale) => acc + calculateDiscountAmount(sale), 0);
        const todaysSales = filterByDateRange(sales, startOfDay(today), endOfDay(today), 'soldAt');
        const todaysDiscount = todaysSales.reduce((acc, sale) => acc + calculateDiscountAmount(sale), 0);

        const discountsByStaff = Object.values(
          filteredSales
            .filter(sale => sale.discountValue && sale.discountValue > 0)
            .reduce((acc, sale) => {
              const staffName = sale.soldByName || 'Unknown Staff';
              if (!acc[staffName]) {
                acc[staffName] = { name: staffName, totalDiscount: 0, count: 0, soldByUid: sale.soldByUid };
              }
              acc[staffName].totalDiscount += calculateDiscountAmount(sale);
              acc[staffName].count += 1;
              return acc;
            }, {} as Record<string, { name: string, totalDiscount: number, count: number, soldByUid: string }>)
        ).sort((a,b) => b.totalDiscount - a.totalDiscount);

        const allMonths = [...new Set(payments.map(p => format(getSafeDate(p.transactionDate)!, 'yyyy-MM')))].sort().reverse();
        let monthRangeStart, monthRangeEnd;
        let filteredMonthlyIncomeLabel = 'This Month';
        const lastMonthDate = subDays(startOfMonth(today), 1);

        if (monthlyIncomeFilter === 'this-month') {
            monthRangeStart = startOfMonth(today);
            monthRangeEnd = endOfMonth(today);
        } else if (monthlyIncomeFilter === 'last-month') {
            monthRangeStart = startOfMonth(lastMonthDate);
            monthRangeEnd = endOfMonth(lastMonthDate);
            filteredMonthlyIncomeLabel = 'Last Month';
        } else {
            const [year, month] = monthlyIncomeFilter.split('-').map(Number);
            monthRangeStart = new Date(year, month - 1, 1);
            monthRangeEnd = endOfMonth(monthRangeStart);
            filteredMonthlyIncomeLabel = format(monthRangeStart, 'MMMM yyyy');
        }
        const monthlyPayments = filterPaymentsByDate(payments, monthRangeStart, monthRangeEnd);
        const filteredMonthlyIncome = calculateIncome(monthlyPayments);

        const allYears = [...new Set(payments.map(p => getSafeDate(p.transactionDate)!.getFullYear().toString()))].sort().reverse();
        let yearRangeStart, yearRangeEnd;
        let filteredYearlyIncomeLabel = 'This Year';

        if (yearlyIncomeFilter === 'this-year') {
            yearRangeStart = startOfYear(today);
            yearRangeEnd = endOfYear(today);
        } else {
            const year = parseInt(yearlyIncomeFilter);
            yearRangeStart = new Date(year, 0, 1);
            yearRangeEnd = endOfYear(yearRangeStart);
            filteredYearlyIncomeLabel = yearlyIncomeFilter;
        }
        const yearlyPayments = filterPaymentsByDate(payments, yearRangeStart, yearRangeEnd);
        const filteredYearlyIncome = calculateIncome(yearlyPayments);

        const filteredReturnsForIncome = filterReturnsByDate(stockReturns, incomeRangeStart, incomeRangeEnd);
        const totalRefundedProfit = filteredReturnsForIncome.reduce((sum, r) => {
            return sum + (r.items || []).reduce((itemSum, item) => {
                const originalSale = sales.find(s => s.id === r.originalSaleId);
                const saleItem = originalSale?.items?.find(si => si.itemId === item.itemId);
                const cost = stockItems.find(si => si.id === item.itemId)?.costPrice || 0;
                const sellingPrice = saleItem?.sellingPrice || (item.refundAmount / item.quantity);
                return itemSum + ((sellingPrice - cost) * item.quantity);
            }, 0);
        }, 0);

        const totalStockProfit = filteredSales.reduce((sum, sale) => {
            return sum + ((sale.items || []).reduce((itemSum, item) => {
                const cost = stockItems.find(si => si.id === item.itemId)?.costPrice || 0;
                return itemSum + ((item.sellingPrice - cost) * item.quantity);
            }, 0));
        }, 0) - totalRefundedProfit;

        const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
        const netProfit = filteredIncome - totalExpenses;
        const totalInventoryValue = stockItems.reduce((acc, item) => acc + ((item.costPrice || 0) * item.quantity), 0);

        const totalCreditGiven = sales.filter(s => s.paymentMethod === 'Credit').reduce((acc, s) => acc + s.totalAmount, 0);
        const totalCreditRepaid = payments.filter(p => p.type === 'Credit Repayment').reduce((acc, p) => acc + p.amount, 0);
        const totalOutstanding = totalCreditGiven - totalCreditRepaid;

        const activeCheckinsCount = bookings.filter(b => ['Active', 'Checked-in'].includes(b.status)).length;
        const dueCheckoutsCount = bookings.filter(b => {
             const checkoutDate = getSafeDate(b.checkOutDate);
             return b.status === 'Active' && checkoutDate && checkoutDate < today;
        }).length;

        const vacantRoomsCount = rooms.reduce((acc, r) => acc + (r.availableRooms || 0), 0);
        const occupiedRoomsCount = rooms.reduce((acc, r) => acc + (r.bookedRooms || 0), 0);

        const metrics = [
            { title: 'Active Check-ins', value: activeCheckinsCount, icon: 'UserCheck' },
            { title: 'Due Checkouts', value: dueCheckoutsCount, icon: 'LogOut' },
            { title: 'Vacant Rooms', value: vacantRoomsCount, icon: 'Bed' },
            { title: 'Occupied Rooms', value: occupiedRoomsCount, icon: 'BedDouble' },
        ];
        const stockMetrics = [
            { title: 'Total Inventory Items', value: stockItems.length, icon: 'Package' },
            { title: 'Out of Stock', value: stockItems.filter(i => i.quantity <= 0).length, icon: 'PackageX', className: "border-destructive text-destructive" },
            { title: 'Low Stock', value: stockItems.filter(i => i.quantity > 0 && i.quantity <= (i.lowStockThreshold || 0)).length, icon: 'AlertTriangle', className: "border-yellow-500 text-yellow-600" },
        ];

        const netIncomeByMethod = filteredPayments.reduce((acc, payment) => {
            const method = payment.paymentMethod || 'Unknown';
            if (payment.status === 'Paid') acc[method] = (acc[method] || 0) + payment.amount;
            return acc;
        }, {} as Record<string, number>);

        const topSellingItems = Object.values(
          filteredSales
            .flatMap(sale => sale.items || [])
            .reduce((acc, item) => {
                const revenue = (item.sellingPrice || 0) * (item.quantity || 0);
                if (!isNaN(revenue)) {
                    acc[item.itemName] = {
                        name: item.itemName,
                        revenue: (acc[item.itemName]?.revenue || 0) + revenue
                    };
                }
                return acc;
            }, {} as Record<string, { name: string, revenue: number }>)
        )
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);


        const chartDays = differenceInDays(incomeRangeEnd, incomeRangeStart) + 1;
        const displayDays = chartDays > 31 ? 31 : chartDays;
        const chartDateArray = Array.from({ length: displayDays }, (_, i) => subDays(incomeRangeEnd, displayDays - 1 - i));

        const weeklyIncomeData = chartDateArray.map(day => ({
            day: format(day, 'EEE'),
            income: calculateIncome(filterPaymentsByDate(payments, startOfDay(day), endOfDay(day)))
        }));

        const totalRooms = rooms.reduce((sum, roomType) => sum + (roomType.totalRooms || 1), 0);
        const weeklyOccupancyData = chartDateArray.map(day => {
            const occupiedCount = bookings.filter(b => {
                const checkIn = getSafeDate(b.checkInDate);
                const checkOut = getSafeDate(b.checkOutDate);
                return checkIn && checkOut && day >= startOfDay(checkIn) && day < startOfDay(checkOut);
            }).length;
            return {
                day: format(day, 'EEE'),
                occupancy: totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0
            };
        });

        const recentPaidBookings = filterPaymentsByDate(payments, incomeRangeStart, incomeRangeEnd).filter(p => p.type === 'Booking' && p.status === 'Paid').sort((a,b) => getSafeDate(b.transactionDate)!.getTime() - getSafeDate(a.transactionDate)!.getTime());
        const recentReservations = filterByDateRange(bookings, incomeRangeStart, incomeRangeEnd, 'createdAt').filter(b => ['Booked', 'Reserved'].includes(b.status)).sort((a,b) => getSafeDate(b.createdAt)!.getTime() - getSafeDate(a.createdAt)!.getTime());
        const recentCancellations = filterByDateRange(bookings, incomeRangeStart, incomeRangeEnd, 'cancelledAt').filter(b => b.status === 'Cancelled').sort((a,b) => getSafeDate(b.cancelledAt!)!.getTime() - getSafeDate(a.cancelledAt!)!.getTime());

        const myPayments = userProfile ? payments.filter(p => p.createdByUid === userProfile.uid) : [];
        const myTotalIncome = calculateIncome(myPayments);
        const myTodaysPayments = filterPaymentsByDate(myPayments, startOfDay(today), endOfDay(today));
        const myTodaysIncome = calculateIncome(myTodaysPayments);
        const grandTotalIncome = calculateIncome(payments);

        const totalRoomIncome = bookings
            .filter(b => b.status !== 'Cancelled' && b.status !== 'Refunded')
            .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

        const totalReservations = bookings.length;
        const activeReservations = bookings.filter(b => b.status === 'Booked' || b.status === 'Reserved').length;
        const totalPaidOnBookings = payments
            .filter(p => p.bookingId && p.status !== 'Refunded')
            .reduce((acc, p) => acc + p.amount, 0);
        const totalRoomOutstanding = totalRoomIncome - totalPaidOnBookings;

        // Calculate outstanding bills for active guests
        const activeBookingIds = new Set(bookings.filter(b => ['Active', 'Checked-in'].includes(b.status)).map(b => b.id));
        const activeOutstandingBills = bills.filter(b => !b.paid && activeBookingIds.has(b.bookingId));
        const totalOutstandingBill = activeOutstandingBills.reduce((sum, b) => sum + (b.total || 0), 0);


        return {
            ...defaultReturn,
            data: data,
            metrics, stockMetrics, totalStockProfit, filteredIncome, filteredIncomeLabel,
            grandTotalIncome, filteredMonthlyIncome, filteredMonthlyIncomeLabel, allMonths,
            filteredYearlyIncome, filteredYearlyIncomeLabel, allYears, netProfit,
            totalExpenses, totalInventoryValue, netIncomeByMethod, totalOutstanding,
            topSellingItems, weeklyOccupancyData, weeklyIncomeData, recentPaidBookings,
            recentReservations, recentCancellations, myTotalIncome, myTodaysIncome, userCurrency,
            totalDiscount, todaysDiscount, discountsByStaff,
            totalRoomIncome, totalRoomOutstanding, totalReservations, activeReservations,
            todaysHotelPosIncome, todaysMainPosIncome, posIncomeLabel, totalOutstandingBill,
        };
    }, [data, userProfile, settings, incomeFilter, monthlyIncomeFilter, yearlyIncomeFilter, dateRange, posIncomeFilter]);

    return { data: memoizedData, isLoading, error };
};
