/**
 * Financial Context
 *
 * Provides centralized financial data management across the application.
 * This ensures all financial cards and components stay synchronized when
 * operations like refunds are processed.
 *
 * Features:
 * - Real-time financial data subscriptions
 * - Automatic recalculation of financial metrics
 * - Centralized refresh triggers
 * - Consistent financial calculations across the app
 */

'use client';

import * as React from 'react';
import {
  collection,
  query,
  onSnapshot,
  Unsubscribe,
  where,
  Timestamp,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { StockSale, StockReturn, Payment, Expense, Booking, SalonService } from '@/lib/types';
import { useBranch } from '@/contexts/branch-context';
import { getSafeDate } from '@/lib/helpers';
import { startOfDay, endOfDay, isWithinInterval, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

interface FinancialStats {
  totalSales: number;
  totalRefunds: number;
  netRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalOutstanding: number;
  totalCreditSales: number;
  totalPaidSales: number;
}

interface PeriodStats {
  today: FinancialStats;
  yesterday: FinancialStats;
  last7Days: FinancialStats;
  thisMonth: FinancialStats;
  lastMonth: FinancialStats;
  thisYear: FinancialStats;
  allTime: FinancialStats;
}

interface FinancialContextType {
  // Raw data
  sales: StockSale[];
  returns: StockReturn[];
  payments: Payment[];
  expenses: Expense[];
  bookings: Booking[];
  salonServices: SalonService[];

  // Loading state
  isLoading: boolean;
  lastUpdated: Date | null;

  // Calculated stats
  periodStats: PeriodStats;

  // Actions
  refreshData: () => void;
  getStatsForDateRange: (from: Date, to?: Date) => FinancialStats;
}

const FinancialContext = React.createContext<FinancialContextType | undefined>(undefined);

export function FinancialProvider({ children }: { children: React.ReactNode }) {
  const firestore = useFirestore();
  const { getCollectionPath, isGlobalMode } = useBranch();

  // Data states
  const [sales, setSales] = React.useState<StockSale[]>([]);
  const [returns, setReturns] = React.useState<StockReturn[]>([]);
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [salonServices, setSalonServices] = React.useState<SalonService[]>([]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  // Real-time subscriptions
  React.useEffect(() => {
    if (!firestore) return;

    setIsLoading(true);
    const unsubscribers: Unsubscribe[] = [];

    // Subscribe to stock sales
    const salesQuery = query(collection(firestore, getCollectionPath('stockSales')));
    const salesUnsub = onSnapshot(salesQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as StockSale);
      setSales(data);
      setLastUpdated(new Date());
    });
    unsubscribers.push(salesUnsub);

    // Subscribe to stock returns
    const returnsQuery = query(collection(firestore, getCollectionPath('stockReturns')));
    const returnsUnsub = onSnapshot(returnsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as StockReturn);
      setReturns(data);
      setLastUpdated(new Date());
    });
    unsubscribers.push(returnsUnsub);

    // Subscribe to payments
    const paymentsQuery = query(collection(firestore, 'payments'));
    const paymentsUnsub = onSnapshot(paymentsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Payment);
      setPayments(data);
      setLastUpdated(new Date());
    });
    unsubscribers.push(paymentsUnsub);

    // Subscribe to expenses
    const expensesQuery = query(collection(firestore, 'expenses'));
    const expensesUnsub = onSnapshot(expensesQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Expense);
      setExpenses(data);
      setLastUpdated(new Date());
    });
    unsubscribers.push(expensesUnsub);

    // Subscribe to bookings
    const bookingsQuery = query(collection(firestore, 'bookings'));
    const bookingsUnsub = onSnapshot(bookingsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Booking);
      setBookings(data);
      setLastUpdated(new Date());
    });
    unsubscribers.push(bookingsUnsub);

    // Subscribe to salon services
    const salonQuery = query(
      collection(firestore, getCollectionPath('salonServices')),
      where('paymentStatus', '==', 'Paid')
    );
    const salonUnsub = onSnapshot(salonQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as SalonService);
      setSalonServices(data);
      setIsLoading(false);
      setLastUpdated(new Date());
    });
    unsubscribers.push(salonUnsub);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [firestore, getCollectionPath, refreshTrigger]);

  // Helper function to calculate stats for a date range
  const calculateStatsForRange = React.useCallback((from: Date, to?: Date): FinancialStats => {
    const endDate = to || from;

    // Filter sales within date range
    const filteredSales = sales.filter((sale) => {
      const saleDate = getSafeDate(sale.soldAt);
      return saleDate && isWithinInterval(saleDate, { start: startOfDay(from), end: endOfDay(endDate) });
    });

    // Filter returns within date range
    const filteredReturns = returns.filter((ret) => {
      const returnDate = getSafeDate(ret.returnedAt);
      return returnDate && isWithinInterval(returnDate, { start: startOfDay(from), end: endOfDay(endDate) });
    });

    // Filter payments within date range
    const filteredPayments = payments.filter((p) => {
      const paymentDate = getSafeDate(p.transactionDate);
      return paymentDate && isWithinInterval(paymentDate, { start: startOfDay(from), end: endOfDay(endDate) });
    });

    // Filter expenses within date range
    const filteredExpenses = expenses.filter((e) => {
      const expenseDate = getSafeDate(e.date);
      return expenseDate && isWithinInterval(expenseDate, { start: startOfDay(from), end: endOfDay(endDate) });
    });

    // Filter bookings within date range (created date)
    const filteredBookings = bookings.filter((b) => {
      const bookingDate = getSafeDate(b.createdAt);
      return bookingDate && isWithinInterval(bookingDate, { start: startOfDay(from), end: endOfDay(endDate) });
    });

    // Filter salon services within date range
    const filteredSalon = salonServices.filter((s) => {
      const serviceDate = getSafeDate(s.createdAt);
      return serviceDate && isWithinInterval(serviceDate, { start: startOfDay(from), end: endOfDay(endDate) });
    });

    // Calculate totals
    const totalSales = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalRefunds = filteredReturns.reduce((sum, r) => sum + r.totalRefundAmount, 0);
    const netRevenue = Math.max(0, totalSales - totalRefunds);

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = netRevenue - totalExpenses;

    // Credit sales calculation
    const creditSales = filteredSales.filter((s) => s.paymentMethod === 'Credit');
    const totalCreditSales = creditSales.reduce((sum, s) => sum + s.totalAmount, 0);

    // Calculate outstanding from credit
    const creditRepayments = filteredPayments.filter((p) => p.type === 'Credit Repayment');
    const totalCreditRepaid = creditRepayments.reduce((sum, p) => sum + p.amount, 0);
    const totalOutstanding = Math.max(0, totalCreditSales - totalCreditRepaid);

    // Paid sales (total sales - credit sales)
    const totalPaidSales = totalSales - totalCreditSales;

    return {
      totalSales,
      totalRefunds,
      netRevenue,
      totalExpenses,
      netProfit,
      totalOutstanding,
      totalCreditSales,
      totalPaidSales,
    };
  }, [sales, returns, payments, expenses, bookings, salonServices]);

  // Calculate period stats
  const periodStats = React.useMemo((): PeriodStats => {
    const today = new Date();
    const yesterday = subDays(today, 1);
    const last7DaysStart = subDays(today, 6);
    const thisMonthStart = startOfMonth(today);
    const lastMonthStart = startOfMonth(subDays(thisMonthStart, 1));
    const lastMonthEnd = endOfMonth(lastMonthStart);
    const thisYearStart = startOfYear(today);

    return {
      today: calculateStatsForRange(today),
      yesterday: calculateStatsForRange(yesterday),
      last7Days: calculateStatsForRange(last7DaysStart, today),
      thisMonth: calculateStatsForRange(thisMonthStart, today),
      lastMonth: calculateStatsForRange(lastMonthStart, lastMonthEnd),
      thisYear: calculateStatsForRange(thisYearStart, today),
      allTime: calculateStatsForRange(new Date(2000, 0, 1), today),
    };
  }, [calculateStatsForRange]);

  // Refresh function to trigger re-subscription
  const refreshData = React.useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Get stats for custom date range
  const getStatsForDateRange = React.useCallback(
    (from: Date, to?: Date): FinancialStats => {
      return calculateStatsForRange(from, to);
    },
    [calculateStatsForRange]
  );

  const value: FinancialContextType = {
    sales,
    returns,
    payments,
    expenses,
    bookings,
    salonServices,
    isLoading,
    lastUpdated,
    periodStats,
    refreshData,
    getStatsForDateRange,
  };

  return <FinancialContext.Provider value={value}>{children}</FinancialContext.Provider>;
}

export function useFinancial() {
  const context = React.useContext(FinancialContext);
  if (context === undefined) {
    throw new Error('useFinancial must be used within a FinancialProvider');
  }
  return context;
}

export function useFinancialStats(period: keyof PeriodStats = 'today') {
  const { periodStats, isLoading } = useFinancial();
  return { stats: periodStats[period], isLoading };
}

export function useNetRevenue(dateRange?: { from: Date; to?: Date }) {
  const { getStatsForDateRange, periodStats } = useFinancial();

  if (dateRange) {
    return getStatsForDateRange(dateRange.from, dateRange.to);
  }

  return periodStats.today.netRevenue;
}
