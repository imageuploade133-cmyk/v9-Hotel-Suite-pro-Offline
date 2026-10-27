'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, where, getDocs, collectionGroup, Timestamp, runTransaction, doc, serverTimestamp, increment, onSnapshot, Unsubscribe } from 'firebase/firestore';
import type { Payment, Expense, StockSale, Booking, SalonService, StockReturn, StockItem, UserProfile, Bill, Room, Transfer } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { StatCard } from '@/components/ui/stat-card';
import { DollarSign, TrendingDown, TrendingUp, Landmark, ArrowRight, CreditCard, Banknote, Smartphone, Printer, Download, ImageIcon, Loader2, Users, ChevronDown, Repeat, Percent, Edit, Trash2, Eye, Undo2 } from 'lucide-react';
import AccountingLoading from './loading';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { getSafeDate, getCheckoutDateTime } from '@/lib/helpers';
import { isWithinInterval, startOfDay, endOfDay, eachMonthOfInterval, format, isSameMonth, startOfYear, isSameYear } from 'date-fns';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle as DialogTitleComponent } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/data-table';
import { useSalesHistoryColumns, type Transaction } from '@/components/sales-history/columns';
import { getExpenseColumns } from '@/components/expenses/columns';
import { AddEditExpenseDialog } from '@/components/expenses/add-edit-expense-dialog';
import { DeleteExpenseDialog } from '@/components/expenses/delete-expense-dialog';
import { ViewSaleDetailsDialog } from '@/components/stock/view-sale-details-dialog';
import { StockSaleReceiptDialog } from '@/components/stock/stock-sale-receipt-dialog';
import { RefundSaleDialog } from '@/components/stock/refund-sale-dialog';
import { getIncomeColumns } from './income-columns';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ReprintReceiptDialog } from '@/components/payments/reprint-receipt-dialog';
import { SalonReceiptDialog } from '@/components/salon/salon-receipt-dialog';
import * as htmlToImage from 'html-to-image';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { AccountingReport } from '@/components/accounting/accounting-report';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { TransferFundsDialog } from '@/components/accounting/transfer-funds-dialog';
import { getTransferHistoryColumns } from '@/components/accounting/transfer-history-columns';
import { TransferReceiptDialog } from '@/components/accounting/transfer-receipt-dialog';
import { DiscountSummary } from '@/components/dashboard/discount-summary';
import { ExpenseReceiptDialog } from '@/components/expenses/expense-receipt-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { useBranch } from '@/contexts/branch-context';
import { processRefund } from '@/lib/refund-service';


type IncomeData = {
    id: string;
    date: Date;
    description: string;
    amount: number;
    source: string;
    originalDoc: any;
    user?: string;
};

export interface ProcessedFolioData {
  id: string;
  guestName: string;
  phoneNumber: string;
  roomNumber: string;
  roomType: string;
  checkInDate: any;
  checkedOutByName?: string | null;
  checkOutDate: any;
  checkedInByName?: string | null;
  roomFee: number;
  guestBill: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  guestBillTotal: number;
  totalBill: number;
  totalPaid: number;
  balanceDue: number;
  status: string;
  payments: { amount: number; staffName: string | null, paymentMethod: string, type?: 'Booking' | 'Additional Charges' | 'Credit Repayment' | 'POS' | 'Service' | 'Gym Membership' }[];
  returns: StockReturn[];
  totalReturns: number;
}

interface SoldItem {
    name: string;
    quantity: number;
    price: number;
}

interface StaffPerformance {
    name: string;
    periodIncome: number;
    totalIncome: number;
    periodItemsSold: number;
    totalItemsSold: number;
    periodBreakdown: { [source: string]: number };
    totalBreakdown: { [key: string]: number };
    periodSoldItems: SoldItem[];
    totalSoldItems: SoldItem[];
}

function AccountingPage() {
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { userProfile, userMap } = useUser();
  const { toast } = useToast();
  const { getCollectionPath } = useBranch();
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  // Real-time data state - NO CACHING for financial data
  const [rawData, setRawData] = React.useState<{
    allBookings: Booking[];
    allPayments: Payment[];
    allExpenses: Expense[];
    allStockSales: StockSale[];
    allSalonServices: SalonService[];
    allStockReturns: StockReturn[];
    allBills: Bill[];
    allTransfers: Transfer[];
    allUsers: UserProfile[];
    allRooms: Room[];
    allStockItems: StockItem[];
  } | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const [expenseToEdit, setExpenseToEdit] = React.useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = React.useState<Expense | null>(null);
  const [isExpenseFormOpen, setIsExpenseFormOpen] = React.useState(false);
  const [isTransferFundsOpen, setIsTransferFundsOpen] = React.useState(false);

  const [saleToView, setSaleToView] = React.useState<StockSale | null>(null);
  const [saleToPrint, setSaleToPrint] = React.useState<StockSale | null>(null);
  const [saleToRefund, setSaleToRefund] = React.useState<StockSale | null>(null);
  const [actionsSale, setActionsSale] = React.useState<Transaction | null>(null);

  const [incomeToPrint, setIncomeToPrint] = React.useState<IncomeData | null>(null);
  const [expenseToPrint, setExpenseToPrint] = React.useState<Expense | null>(null);
  const [transferToPrint, setTransferToPrint] = React.useState<Transfer | null>(null);
  const [actionsExpense, setActionsExpense] = React.useState<Expense | null>(null);
  const [actionsTransfer, setActionsTransfer] = React.useState<Transfer | null>(null);


  const [isExporting, setIsExporting] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const printRef = React.useRef<HTMLDivElement>(null);

  const { hasPermission } = usePermissions();
  const canProcessRefunds = hasPermission(PagePermission.PROCESS_SALE_REFUNDS);

  // Real-time subscriptions for financial data
  React.useEffect(() => {
    if (!firestore) return;

    setIsLoading(true);
    const unsubscribers: Unsubscribe[] = [];

    // Subscribe to all collections with real-time updates
    const collections = [
      { name: 'bookings', key: 'allBookings' as const },
      { name: 'payments', key: 'allPayments' as const },
      { name: 'expenses', key: 'allExpenses' as const },
      { name: 'stockSales', key: 'allStockSales' as const },
      { name: 'salonServices', key: 'allSalonServices' as const },
      { name: 'stockReturns', key: 'allStockReturns' as const },
      { name: 'transfers', key: 'allTransfers' as const },
      { name: 'users', key: 'allUsers' as const },
      { name: 'rooms', key: 'allRooms' as const },
      { name: 'stock', key: 'allStockItems' as const },
    ];

    collections.forEach(({ name, key }) => {
      const collPath = getCollectionPath(name);
      const q = name === 'salonServices'
        ? query(collection(firestore, collPath), where('paymentStatus', '==', 'Paid'))
        : name === 'transfers'
        ? query(collection(firestore, collPath), orderBy('transferredAt', 'desc'))
        : query(collection(firestore, collPath));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          setRawData(prev => {
            const newData = prev ? { ...prev, [key]: docs } : {
              allBookings: [],
              allPayments: [],
              allExpenses: [],
              allStockSales: [],
              allSalonServices: [],
              allStockReturns: [],
              allBills: [],
              allTransfers: [],
              allUsers: [],
              allRooms: [],
              allStockItems: [],
              [key]: docs,
            };
            return newData;
          });
          setIsLoading(false);
        },
        (err) => {
          console.error(`Error subscribing to ${name}:`, err);
          setIsLoading(false);
        }
      );
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [firestore, getCollectionPath]);

  const processedData = React.useMemo(() => {
    if (!rawData) return null;
    const {
        allBookings: rawBookings, allPayments: rawPayments, allExpenses: rawExpenses, allStockSales: rawStockSales, allSalonServices: rawSalonServices, allStockReturns: rawStockReturns, allBills: rawBills, allTransfers: rawTransfers, allUsers: rawUsers, allRooms: rawRooms, allStockItems: rawStockItems
    } = rawData;

    const allBookings = rawBookings || [];
    const allPayments = rawPayments || [];
    const allExpenses = rawExpenses || [];
    const allStockSales = rawStockSales || [];
    const allSalonServices = rawSalonServices || [];
    const allStockReturns = rawStockReturns || [];
    const allBills = rawBills || [];
    const allTransfers = rawTransfers || [];
    const allUsers = rawUsers || [];
    const allRooms = rawRooms || [];
    const allStockItems = rawStockItems || [];

    const filterByRange = <T extends { [key: string]: any }>(data: T[], dateKey: string): T[] => {
      if (!dateRange?.from) return data;
      const start = dateRange.from;
      const end = dateRange.to || dateRange.from;
      return data.filter(item => {
        const itemDate = getSafeDate(item[dateKey]);
        return itemDate && itemDate >= start && itemDate <= end;
      });
    };

    const bookings = filterByRange(allBookings, 'createdAt');
    const payments = filterByRange(allPayments, 'transactionDate');
    const expenses = filterByRange(allExpenses, 'date');
    const stockSales = filterByRange(allStockSales, 'soldAt');
    const salonServices = filterByRange(allSalonServices, 'createdAt');
    const stockReturns = filterByRange(allStockReturns, 'returnedAt');
    const periodTransfers = filterByRange(allTransfers, 'transferredAt');

    const localUserMap = new Map(allUsers?.map(u => [u.uid, u.name]));

    const allBookingPayments = (bookings || [])
        .filter(b => b.paymentMethod && b.status !== 'Refunded' && b.status !== 'Cancelled')
        .map(b => ({
            id: b.id,
            amount: b.totalAmount || 0,
            date: getSafeDate(b.createdAt)!,
            description: `Booking: Room ${b.roomNumber} - ${b.guestName}`,
            source: 'Bookings',
            paymentMethod: b.paymentMethod,
            user: b.createdByName || localUserMap.get(b.createdByUid || ''),
            originalDoc: b,
        }));

    const allAdditionalPayments = (payments || []).filter(p => p.status !== 'Refunded').map(p => ({
        id: p.id,
        amount: p.amount,
        date: getSafeDate(p.transactionDate)!,
        description: `Payment: ${p.type} - ${p.guestName}`,
        source: 'Payments',
        paymentMethod: p.paymentMethod,
        user: p.createdByName || localUserMap.get(p.createdByUid || ''),
        originalDoc: p,
    }));

    const allStockSalesPayments = (stockSales || [])
    .filter(s => s.paymentStatus === 'Paid')
    .map(s => ({
        id: s.id,
        amount: s.totalAmount,
        date: getSafeDate(s.soldAt)!,
        description: `Stock Sale #${s.saleId}`,
        source: 'Stock Sales',
        paymentMethod: s.paymentMethod,
        user: s.soldByName || localUserMap.get(s.soldByUid || ''),
        originalDoc: s,
        items: s.items,
    }));

    const allSalonServicesPayments = (salonServices || [])
    .filter(s => s.paymentStatus === 'Paid')
    .map(s => ({
        id: s.id,
        amount: s.totalPrice,
        date: getSafeDate(s.createdAt)!,
        description: `Salon Service #${s.orderNumber}`,
        source: 'Salon',
        paymentMethod: s.paymentMethod,
        user: s.staffName || localUserMap.get(s.staffId || ''),
        originalDoc: s,
    }));

    const allIncomeSources = [...allBookingPayments, ...allAdditionalPayments, ...allStockSalesPayments, ...allSalonServicesPayments].filter(p => p.date);

    const allStockReturnsPeriod = (stockReturns || []).map(r => ({
        amount: r.totalRefundAmount,
        date: getSafeDate(r.returnedAt)!
    }));

    const allRefundsAndReturns = [...allStockReturnsPeriod].filter(r => r.date);

    const safeExpenses = expenses || [];

    const creditSales = stockSales.filter(s => s.paymentMethod === 'Credit');
    const creditRepayments = payments.filter(p => p.type === 'Credit Repayment');

    const totalCreditGiven = creditSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalCreditRepaid = creditRepayments.reduce((acc, p) => acc + p.amount, 0);
    const totalOutstanding = totalCreditGiven - totalCreditRepaid;

    const totalGrossIncome = allIncomeSources.reduce((acc, p) => acc + p.amount, 0);
    const totalRefunds = allRefundsAndReturns.reduce((acc, r) => acc + r.amount, 0);
    const totalNetIncome = Math.max(0, totalGrossIncome - totalRefunds);

    const totalExpenses = safeExpenses.reduce((acc, e) => acc + e.amount, 0);

    const totalCostOfGoodsSold = (stockSales || []).reduce((sum, sale) => {
        const saleCost = sale.items.reduce((itemSum, saleItem) => {
            const stockItem = (allStockItems || []).find(si => si.id === saleItem.itemId);
            return itemSum + (stockItem?.costPrice || 0) * saleItem.quantity;
        }, 0);
        return sum + saleCost;
    }, 0);

    const netProfit = totalNetIncome - totalExpenses - totalCostOfGoodsSold;

    const combinedTransactions: Transaction[] = [
    ...(stockSales || []).map(s => ({ ...s, type: 'Sale' as const, transactionId: s.saleId })),
    ...(stockReturns || []).map(r => ({ ...r, type: 'Return' as const, transactionId: r.refundId })),
    ].sort((a,b) => {
        const dateA = getSafeDate((a as StockSale).soldAt || (a as StockReturn).returnedAt)!;
        const dateB = getSafeDate((b as StockSale).soldAt || (b as StockReturn).returnedAt)!;
        return dateB.getTime() - dateA.getTime();
    });

    const netIncomeByMethod: { [key: string]: { amount: number; count: number } } = {};

    allIncomeSources.forEach(p => {
        const method = p.paymentMethod;
        if (method) {
            if (!netIncomeByMethod[method]) {
                netIncomeByMethod[method] = { amount: 0, count: 0 };
            }
            netIncomeByMethod[method].amount += p.amount;
            netIncomeByMethod[method].count += 1;
        }
    });

    (stockReturns || []).forEach(r => {
        const originalSale = (allStockSales || []).find(s => s.id === r.originalSaleId);
        const method = originalSale?.paymentMethod;
        if (method && netIncomeByMethod[method]) {
            netIncomeByMethod[method].amount = Math.max(0, netIncomeByMethod[method].amount - r.totalRefundAmount);
        }
    });

    safeExpenses.forEach(expense => {
        if (expense.status !== 'Voided') {
            const method = expense.paymentMethod;
            if (netIncomeByMethod[method]) {
                netIncomeByMethod[method].amount -= expense.amount;
            } else {
                netIncomeByMethod[method] = { amount: -expense.amount, count: 0 };
            }
        }
    });

    periodTransfers.forEach(transfer => {
        if (netIncomeByMethod[transfer.fromAccount]) {
            netIncomeByMethod[transfer.fromAccount].amount -= transfer.amount;
        } else {
            netIncomeByMethod[transfer.fromAccount] = { amount: -transfer.amount, count: 0 };
        }
        if (netIncomeByMethod[transfer.toAccount]) {
            netIncomeByMethod[transfer.toAccount].amount += transfer.amount;
        } else {
            netIncomeByMethod[transfer.toAccount] = { amount: transfer.amount, count: 0 };
        }
    });

    const monthlyPerformanceData: { month: string; revenue: number; profit: number }[] = [];
    const yearStart = dateRange?.from || startOfYear(new Date());
    const yearEnd = dateRange?.to || new Date();

    if (yearStart) {
        const intervalMonths = eachMonthOfInterval({ start: yearStart, end: yearEnd });
        const allIncome = [
            ...allBookings.filter(b => b.paymentMethod && b.status !== 'Refunded' && b.status !== 'Cancelled').map(b => ({ amount: b.totalAmount || 0, date: getSafeDate(b.createdAt)! })),
            ...allPayments.filter(p => p.status !== 'Refunded').map(p => ({ amount: p.amount, date: getSafeDate(p.transactionDate)! })),
            ...allStockSales.filter(s => s.paymentStatus === 'Paid').map(s => ({ amount: s.totalAmount, date: getSafeDate(s.soldAt)! })),
            ...allSalonServices.filter(s => s.paymentStatus === 'Paid').map(s => ({ amount: s.totalPrice, date: getSafeDate(s.createdAt)! })),
        ].filter(i => i.date);

        intervalMonths.forEach(month => {
            const monthlyIncome = allIncome
                .filter(p => isSameMonth(p.date, month) && isSameYear(p.date, month))
                .reduce((sum, p) => sum + p.amount, 0);

            const monthlyRefunds = allStockReturns
                .filter(r => {
                    const returnDate = getSafeDate(r.returnedAt);
                    return returnDate && isSameMonth(returnDate, month) && isSameYear(returnDate, month);
                })
                .reduce((sum, r) => sum + r.totalRefundAmount, 0);

            const monthlyExpenses = allExpenses
                .filter(e => {
                    const expenseDate = getSafeDate(e.date);
                    return expenseDate && isSameMonth(expenseDate, month) && isSameYear(expenseDate, month);
                })
                .reduce((sum, e) => sum + e.amount, 0);

            const monthlyStockSales = allStockSales
                .filter(s => {
                    const saleDate = getSafeDate(s.soldAt);
                    return saleDate && isSameMonth(saleDate, month) && isSameYear(saleDate, month);
                });

            const monthlyCOGS = monthlyStockSales.reduce((sum, sale) => {
                  const saleCost = sale.items.reduce((itemSum, saleItem) => {
                    const stockItem = (allStockItems || []).find(si => si.id === saleItem.itemId);
                    return itemSum + (stockItem?.costPrice || 0) * saleItem.quantity;
                }, 0);
                return sum + saleCost;
            }, 0);

            const netMonthlyIncome = Math.max(0, monthlyIncome - monthlyRefunds);

            monthlyPerformanceData.push({
                month: format(month, "MMM ''yy"),
                revenue: netMonthlyIncome,
                profit: netMonthlyIncome - monthlyExpenses - monthlyCOGS,
            });
        });
    }

    const roomsMap = new Map(allRooms?.map(room => [room.id, room]));

    const folioData: ProcessedFolioData[] = (bookings || []).map(booking => {
      const roomType = roomsMap.get(booking.roomId)?.name || 'N/A';
      const bookingBills = allBills?.filter(b => (b as any).bookingId === booking.id) || [];
      const guestBillItems = bookingBills.flatMap(bill =>
        bill.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.price * item.quantity,
        }))
      );
      const guestBillTotal = guestBillItems.reduce((acc, item) => acc + item.total, 0);
      const bookingRoomFee = booking.totalAmount || 0;
      const bookingReturns = stockReturns?.filter(r => (r as any).bookingId === booking.id) || [];
      const totalReturns = bookingReturns.reduce((acc, item) => acc + item.totalRefundAmount, 0);
      const totalCharges = bookingRoomFee + guestBillTotal;
      const totalBill = totalCharges - totalReturns;

      const associatedPayments = payments?.filter(p => p.bookingId === booking.id) || [];

      let totalPaid = 0;
      const isCheckedIn = booking.status === 'Active' || booking.status === 'Checked-in'
      if (booking.paymentMethod || isCheckedIn) {
          totalPaid += bookingRoomFee;
      }

      const paidBillTotal = bookingBills.filter(b => b.paid).reduce((acc, b) => acc + b.total, 0);
      totalPaid += paidBillTotal;

      const balanceDue = totalBill - totalPaid;

      const getPaymentStaffName = (payment: Payment) => {
        if (payment.type === 'Booking') {
          return booking.createdByName || localUserMap.get(booking.createdByUid || '');
        }
        const bill = allBills?.find(b => b.paymentId === payment.id);
        return bill?.createdByName || localUserMap.get(bill?.createdBy || '') || localUserMap.get(payment.createdByUid || '');
      };

      return {
        id: booking.id,
        guestName: booking.guestName,
        phoneNumber: booking.guestPhoneNumber || 'N/A',
        roomNumber: booking.roomNumber || 'N/A',
        roomType,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        checkedInByName: booking.checkedInByName,
        checkedOutByName: booking.checkedOutByName,
        roomFee: bookingRoomFee,
        guestBill: guestBillItems,
        guestBillTotal,
        totalBill,
        totalPaid,
        balanceDue,
        status: booking.status,
        payments: associatedPayments.map(p => ({
          amount: p.amount,
          staffName: getPaymentStaffName(p),
          paymentMethod: p.paymentMethod,
          type: p.type as 'Booking' | 'Additional Charges',
        })),
        returns: [],
        totalReturns,
      };
    });

    const staffPerformanceData = allUsers.map(user => {
      const name = user.name || user.email;

      const periodIncomes = allIncomeSources.filter(p => p.user === name);
      const periodIncome = periodIncomes.reduce((acc, p) => acc + p.amount, 0);
      const periodBreakdown = periodIncomes.reduce((acc, p) => {
        acc[p.source] = (acc[p.source] || 0) + p.amount;
        return acc;
      }, {} as { [key: string]: number });
      const periodSales = stockSales.filter(s => s.soldByName === name && s.status !== 'Refunded');
      const periodItemsSold = periodSales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
      const periodSoldItemsList = periodSales.flatMap(sale => sale.items).reduce((acc, item) => {
            const existing = acc.find(i => i.name === item.itemName);
            if (existing) {
                existing.quantity += item.quantity;
            } else {
                acc.push({ name: item.itemName, quantity: item.quantity, price: item.sellingPrice });
            }
            return acc;
      }, [] as SoldItem[]);

      const allTimeIncomes = [
        ...(allBookings || []).filter(b => (b.createdByUid === user.uid || b.createdByName === name) && b.status !== 'Refunded' && b.status !== 'Cancelled').map(b => ({ source: 'Bookings', amount: b.totalAmount || 0 })),
        ...(allPayments || []).filter(p => (p.createdByUid === user.uid || p.createdByName === name) && p.status !== 'Refunded').map(p => ({ source: 'Payments', amount: p.amount })),
        ...(allStockSales || []).filter(s => (s.soldByUid === user.uid || s.soldByName === name) && s.status !== 'Refunded').map(s => ({ source: 'Stock Sales', amount: s.totalAmount })),
        ...(allSalonServices || []).filter(s => s.staffId === user.uid || s.staffName === name).map(s => ({ source: 'Salon', amount: s.totalPrice })),
      ];

      const totalIncome = allTimeIncomes.reduce((acc, p) => acc + p.amount, 0);
      const totalBreakdown = allTimeIncomes.reduce((acc, p) => {
        acc[p.source] = (acc[p.source] || 0) + p.amount;
        return acc;
      }, {} as { [key: string]: number });
      const totalSales = (allStockSales || []).filter(s => (s.soldByUid === user.uid || s.soldByName === name) && s.status !== 'Refunded');
      const totalItemsSold = totalSales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
      const totalSoldItemsList = totalSales.flatMap(sale => sale.items).reduce((acc, item) => {
          const existing = acc.find(i => i.name === item.itemName);
          if (existing) {
              existing.quantity += item.quantity;
          } else {
              acc.push({ name: item.itemName, quantity: item.quantity, price: item.sellingPrice });
          }
          return acc;
      }, [] as SoldItem[]);

      return {
        name,
        periodIncome,
        totalIncome,
        periodItemsSold,
        totalItemsSold,
        periodBreakdown,
        totalBreakdown,
        periodSoldItems: periodSoldItemsList,
        totalSoldItems: totalSoldItemsList,
      };
    }).filter(staff => staff.totalIncome > 0).sort((a,b) => b.periodIncome - a.periodIncome);

    const balances = new Map<string, number>();

    (allPayments).filter(p => p.status !== 'Refunded').forEach(p => {
      const method = p.paymentMethod;
      if(method) {
        balances.set(method, (balances.get(method) || 0) + p.amount);
      }
    });

    (allExpenses).filter(e => e.status !== 'Voided').forEach(expense => {
        const method = expense.paymentMethod;
        balances.set(method, (balances.get(method) || 0) - expense.amount);
    });

    (allTransfers || []).forEach(transfer => {
        balances.set(transfer.fromAccount, (balances.get(transfer.fromAccount) || 0) - transfer.amount);
        balances.set(transfer.toAccount, (balances.get(transfer.toAccount) || 0) + transfer.amount);
    });

    const calculateDiscountAmount = (sale: StockSale) => {
        if (!sale.discountValue) return 0;
        const subtotal = sale.items.reduce((acc, item) => acc + (item.sellingPrice * item.quantity), 0);
        if (sale.discountType === 'percentage') {
          return (subtotal * sale.discountValue) / 100;
        }
        return sale.discountValue;
    };

    const totalDiscountInPeriod = stockSales.reduce((acc, sale) => acc + calculateDiscountAmount(sale), 0);

    const discountsByStaffInPeriod = Object.values(
      stockSales
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

    return {
        summaryStats: { totalIncome: totalNetIncome, totalExpenses, netProfit, totalOutstanding, },
        discountData: { totalDiscount: totalDiscountInPeriod, discountsByStaff: discountsByStaffInPeriod },
        transactions: combinedTransactions,
        incomeData: allIncomeSources,
        filteredExpenses: safeExpenses,
        netIncomeByMethod: netIncomeByMethod,
        monthlyPerformanceData,
        guestFolioData: folioData,
        staffPerformanceData: staffPerformanceData,
        accountBalances: balances,
        transferHistory: periodTransfers,
        userMap: new Map(allUsers.map(u => [u.uid, u as any])),
        creditRepayments,
    };
  }, [rawData, dateRange]);


  const { summaryStats, discountData, transactions, incomeData, filteredExpenses, netIncomeByMethod, monthlyPerformanceData, guestFolioData, staffPerformanceData, accountBalances, transferHistory, creditRepayments } = processedData || {
      summaryStats: { totalIncome: 0, totalExpenses: 0, netProfit: 0, totalOutstanding: 0 },
      discountData: { totalDiscount: 0, discountsByStaff: [] },
      transactions: [],
      incomeData: [],
      filteredExpenses: [],
      netIncomeByMethod: {},
      monthlyPerformanceData: [],
      guestFolioData: [],
      staffPerformanceData: [],
      accountBalances: new Map(),
      transferHistory: [],
      creditRepayments: [],
  };

  const isPageLoading = isLoading;

  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);


  const confirmRefund = async (saleToRefund: StockSale, itemsToReturn: { itemId: string; quantity: number, itemName: string, sellingPrice: number }[], reason: string) => {
    if (!firestore || !userProfile) {
        throw new Error('User or Firestore not available.');
    }

    const result = await processRefund(saleToRefund, itemsToReturn, reason, {
        firestore,
        getCollectionPath,
        userProfile,
        formatCurrency,
    });

    if (result.success) {
        toast({
            variant: 'success',
            title: 'Refund Processed',
            description: `Refund of ${formatCurrency(result.totalRefundAmount)} has been successfully processed.`
        });
    } else {
        toast({
            variant: 'destructive',
            title: 'Refund Failed',
            description: result.error || 'Failed to process refund'
        });
        throw new Error(result.error || 'Failed to process refund');
    }
  };

  const salesColumns = useSalesHistoryColumns({
      currency,
      onActions: (transaction) => setActionsSale(transaction),
      userMap: userMap || new Map(),
      creditPayments: creditRepayments,
  });

  const expenseColumns = React.useMemo(() => getExpenseColumns({
      currency,
      onActions: (expense) => setActionsExpense(expense),
  }), [currency]);

  const incomeColumns = React.useMemo(() => getIncomeColumns({ currency, onReprint: setIncomeToPrint }), [currency]);

  const transferHistoryColumns = React.useMemo(() => {
    return getTransferHistoryColumns({ currency, onActions: setActionsTransfer });
  }, [currency]);


  const chartConfig = {
    revenue: { label: 'Revenue', color: 'hsl(var(--primary))' },
    profit: { label: 'Profit', color: 'hsl(var(--chart-2))' },
  } satisfies React.ComponentProps<typeof ChartContainer>['config'];

  const getPaymentMethodIcon = (method: string) => {
    const lowerMethod = method.toLowerCase();
    if (lowerMethod.includes('card')) return CreditCard;
    if (lowerMethod.includes('cash')) return Banknote;
    if (lowerMethod.includes('transfer') || lowerMethod.includes('bank')) return Landmark;
    if (lowerMethod.includes('mobile')) return Smartphone;
    return DollarSign;
  };

  const paymentForReprint: Payment | null = React.useMemo(() => {
    if (!incomeToPrint || incomeToPrint.source !== 'Bookings') return null;
    const booking = incomeToPrint.originalDoc as Booking;
    return {
      type: 'Booking',
      id: booking.bookingId || booking.id,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhotoURL: booking.guestPhotoURL,
      roomNumber: booking.roomNumber!,
      amount: booking.totalAmount || 0,
      paymentMethod: booking.paymentMethod || 'On-site',
      status: 'Paid',
      transactionDate: getSafeDate(booking.checkInDate) || new Date(),
      bookingDetails: booking,
      createdByUid: booking.createdByUid,
      createdByName: booking.createdByName,
    };
  }, [incomeToPrint]);

  const handlePrint = () => {
    const content = printRef.current;
    if (content) {
      document.body.classList.add('print-container');
      window.print();
    }
  };

  const handleDownloadImage = async () => {
    const reportNode = printRef.current;
    if (!reportNode) {
        return;
    }
    setIsExporting(true);
    try {
        const dataUrl = await htmlToImage.toPng(reportNode, { quality: 1.0, pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `accounting-report_${new Date().toISOString().split('T')[0]}.png`;
        link.href = dataUrl;
        link.click();
    } catch (error) {
        console.error("Image generation failed:", error);
    } finally {
       setIsExporting(false);
    }
  };

  const guestFolioColumns = React.useMemo(() => {
    const checkoutTime = settings?.checkoutTime || '11:00';

    const statusVariantMap: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' } = {
      'Active': 'success',
      'Checked-in': 'success',
      'Checked-out': 'secondary',
      'Cancelled': 'destructive',
      'Refunded': 'destructive',
      'Booked': 'outline',
      'Reserved': 'outline'
    };

    return [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }: { row: { original: ProcessedFolioData }}) => <div className="font-mono text-xs">{row.original.id.substring(0, 8)}...</div>,
      },
      {
        accessorKey: 'guestName',
        header: 'Guest',
        cell: ({ row }: { row: { original: ProcessedFolioData }}) => (
          <div>
            <div className="font-medium">{row.original.guestName}</div>
            <div className="text-xs text-muted-foreground">{row.original.phoneNumber}</div>
          </div>
        ),
      },
      {
        accessorKey: 'roomNumber',
        header: 'Room',
        cell: ({ row }: { row: { original: ProcessedFolioData }}) => (
          <div>
            <div className="font-medium">Room {row.original.roomNumber}</div>
            <div className="text-xs text-muted-foreground">{row.original.roomType}</div>
          </div>
        ),
      },
      {
          accessorKey: 'checkInDate',
          header: 'Check-in',
          cell: ({ row }: { row: { original: ProcessedFolioData }}) => {
              const checkInDate = getSafeDate(row.original.checkInDate);
              const staffName = row.original.checkedInByName;
              return (
                <div>
                  <div>{checkInDate ? format(checkInDate, 'EEEE dd-MM-yyyy, p') : 'N/A'}</div>
                  {staffName && <div className="text-xs text-muted-foreground">by {staffName}</div>}
                </div>
              )
          }
      },
      {
          accessorKey: 'checkOutDate',
          header: 'Check-out',
          cell: ({ row }: { row: { original: ProcessedFolioData }}) => {
              const checkOutDate = getSafeDate(row.original.checkOutDate);
              const staffName = row.original.checkedOutByName;
              return (
                  <div>
                      <div>{checkOutDate ? format(getCheckoutDateTime(checkOutDate, checkoutTime), 'EEEE dd-MM-yyyy, p') : 'N/A'}</div>
                      {staffName && <div className="text-xs text-muted-foreground">by {staffName}</div>}
                  </div>
              )
          }
      },
      {
        accessorKey: 'guestBill',
        header: 'Guest Bill / Payments / Returns',
        cell: ({ row }: { row: { original: ProcessedFolioData }}) => {
          const roomPayment = row.original.payments.find(p => p.type === 'Booking');
          return (
              <div className="text-xs">
              <p>
                  <b>Room Fee:</b> {formatCurrency(row.original.roomFee)}
                  {roomPayment && (
                      <span className="text-muted-foreground text-[11px] ml-2">
                          = Payment ({roomPayment.paymentMethod}) by {roomPayment.staffName}
                      </span>
                  )}
              </p>
              {row.original.guestBill.length > 0 && (
                  <div className="mt-1">
                  <p><b>Added Bills:</b></p>
                  <ul className="list-disc pl-4">
                      {row.original.guestBill.map((item, index) => (
                          <li key={index}>
                              {item.name} (x{item.quantity}) - {formatCurrency(item.total)}
                          </li>
                      ))}
                  </ul>
                  <p className="font-semibold">Sub-total: {formatCurrency(row.original.guestBillTotal)}</p>
                  </div>
              )}
              {row.original.returns.length > 0 && (
                  <div className="mt-1 text-destructive">
                      <p><b>Returns/Voided:</b></p>
                      <ul className="list-disc pl-4">
                          {row.original.returns.flatMap((returnItem, returnIndex) =>
                              returnItem.items.map((item, itemIndex) => (
                                  <li key={`${returnIndex}-${itemIndex}`}>
                                      {item.itemName} (x{item.quantity}) - {formatCurrency(item.refundAmount)}
                                  </li>
                              ))
                          )}
                      </ul>
                      <p className="font-semibold">Sub-total: {formatCurrency(row.original.totalReturns)}</p>
                  </div>
              )}
              {row.original.payments.filter(p => p.type !== 'Booking').map((p, i) => (
                  <div key={i} className="text-green-600 mt-1"><b>Payment ({p.paymentMethod}) by {p.staffName}:</b> {formatCurrency(p.amount)}</div>
              ))}
              </div>
          );
        },
      },
      {
        accessorKey: 'totalBill',
        header: 'Total Bill',
        cell: ({ row }: { row: { original: ProcessedFolioData }}) => <div className="text-right font-semibold">{formatCurrency(row.original.totalBill)}</div>,
      },
      {
          accessorKey: 'totalPaid',
          header: 'Total Paid',
          cell: ({ row }: { row: { original: ProcessedFolioData }}) => <div className="text-right font-semibold text-green-600">{formatCurrency(row.original.totalPaid)}</div>
      },
      {
        accessorKey: 'balanceDue',
        header: 'Balance Due',
        cell: ({ row }: { row: { original: ProcessedFolioData }}) => {
          const balance = row.original.balanceDue;
          return (
            <div className={`text-right font-bold ${balance > 0 ? 'text-destructive' : 'text-green-600'}`}>
              {formatCurrency(balance)}
            </div>
          );
        },
      },
       {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }: { row: { original: ProcessedFolioData }}) => {
          const status = row.original.status as string;
          const variant = statusVariantMap[status] || 'secondary';
          return <Badge variant={variant} className="capitalize">{status}</Badge>;
        }
      }
    ];
  }, [settings, currency, userMap]);

  const isDateFilterActive = !!dateRange;


  if (isPageLoading) {
    return <AccountingLoading />;
  }

  return (
    <>
      <div className="print-container hidden">
        <div ref={printRef} className="print-content">
          <AccountingReport
            incomeData={incomeData}
            expenseData={filteredExpenses}
            salesData={transactions}
            userProfile={userProfile}
            settings={settings}
            dateRange={dateRange}
            summaryStats={summaryStats}
            userMap={userMap || new Map()}
          />
        </div>
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Landmark className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Accounting</h1>
              <p className="text-muted-foreground">
                An overview of your income, expenses, and overall financial health.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
             <Button variant="outline" onClick={() => setIsTransferFundsOpen(true)}>
                <Repeat className="mr-2 h-4 w-4" /> Transfer Funds
             </Button>
             <Button asChild>
                <Link href="/expenses">
                    Manage Expenses <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                title="Total Income"
                value={formatCurrency(summaryStats.totalIncome)}
                icon={TrendingUp}
                description={dateRange?.from ? "Total revenue in the selected period." : "All-time gross revenue"}
                className="border-green-500 text-green-500"
            />
            <StatCard
                title="Total Expenses"
                value={formatCurrency(summaryStats.totalExpenses)}
                icon={TrendingDown}
                description={dateRange?.from ? "Total expenses in the selected period." : "All-time expenses"}
                className="border-destructive text-destructive"
            />
            <StatCard
                title="Net Profit"
                value={formatCurrency(summaryStats.netProfit)}
                icon={DollarSign}
                description="Income minus expenses &amp; COGS for the period."
                className={summaryStats.netProfit >= 0 ? "border-green-500 text-green-500" : "border-destructive text-destructive"}
            />
             <StatCard
                title="Total Outstanding"
                value={formatCurrency(summaryStats.totalOutstanding)}
                icon={CreditCard}
                description="All-time outstanding balance from credit sales."
                className={summaryStats.totalOutstanding > 0 ? "border-destructive text-destructive" : "border-green-500 text-green-500"}
            />
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Net Income by Payment Method</CardTitle>
                <CardDescription>Breakdown of net revenue (income - expenses - transfers) for the selected period.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(netIncomeByMethod).map(([method, data]) => (
                    <StatCard
                    key={method}
                    title={`${method} Total`}
                    value={formatCurrency(data.amount)}
                    icon={getPaymentMethodIcon(method)}
                    description={`Net for ${method} in the period.`}
                    className={data.amount < 0 ? 'border-destructive text-destructive' : ''}
                    />
                ))}
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                  <Users className="h-6 w-6 text-primary" />
                  <CardTitle>Staff Performance</CardTitle>
                </div>
                <CardDescription>Income generated by each staff member for the selected period.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="space-y-2">
                    {staffPerformanceData.map(staff => (
                        <Collapsible key={staff.name} className="border rounded-lg">
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                                <div className="font-medium">{staff.name}</div>
                                <div className="flex items-center gap-4 text-right">
                                    <div>
                                        <p className="text-xs text-muted-foreground">{dateRange?.from ? 'Period Items' : 'All-Time Items'}</p>
                                        <p className="font-semibold">{dateRange?.from ? staff.periodItemsSold : staff.totalItemsSold}</p>
                                    </div>
                                     <div>
                                        <p className="text-xs text-muted-foreground">{dateRange?.from ? 'Period Income' : 'All-Time Income'}</p>
                                        <p className="font-semibold">{formatCurrency(dateRange?.from ? staff.periodIncome : staff.totalIncome)}</p>
                                    </div>
                                </div>
                                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <Tabs defaultValue="breakdown" className="p-4 border-t">
                                    <TabsList>
                                        <TabsTrigger value="breakdown">Income Breakdown</TabsTrigger>
                                        <TabsTrigger value="items">Sold Items</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="breakdown" className="mt-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <h4 className="font-semibold mb-2">{dateRange?.from ? "Period's Breakdown" : 'All-Time Breakdown'}</h4>
                                                <div className="space-y-1 text-sm">
                                                    {Object.entries(dateRange?.from ? staff.periodBreakdown : staff.totalBreakdown).map(([source, amount]) => (
                                                        <div key={source} className="flex justify-between">
                                                            <span className="text-muted-foreground">{source}:</span>
                                                            <span>{formatCurrency(amount)}</span>
                                                        </div>
                                                    ))}
                                                    {Object.keys(dateRange?.from ? staff.periodBreakdown : staff.totalBreakdown).length === 0 && <p className="text-xs text-muted-foreground">No income in this period.</p>}
                                                </div>
                                            </div>
                                             <div>
                                                <h4 className="font-semibold mb-2">All-Time Breakdown</h4>
                                                <div className="space-y-1 text-sm">
                                                    {Object.entries(staff.totalBreakdown).map(([source, amount]) => (
                                                        <div key={source} className="flex justify-between">
                                                            <span className="text-muted-foreground">{source}:</span>
                                                            <span>{formatCurrency(amount)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="items" className="mt-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <h4 className="font-semibold mb-2">{dateRange?.from ? "Period's Sold Items" : 'All-Time Sold Items'} ({dateRange?.from ? staff.periodItemsSold : staff.totalItemsSold} total)</h4>
                                                {(dateRange?.from ? staff.periodSoldItems : staff.totalSoldItems).length > 0 ? (
                                                    <Table>
                                                        <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-center">Qty</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
                                                        <TableBody>
                                                            {(dateRange?.from ? staff.periodSoldItems : staff.totalSoldItems).map((item, index) => (
                                                                <TableRow key={index}><TableCell>{item.name}</TableCell><TableCell className="text-center">{item.quantity}</TableCell><TableCell className="text-right">{formatCurrency(item.price)}</TableCell></TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                ) : <p className="text-xs text-muted-foreground">No items sold in this period.</p>}
                                            </div>
                                             <div>
                                                <h4 className="font-semibold mb-2">All-Time Sold Items ({staff.totalItemsSold} total)</h4>
                                                {staff.totalSoldItems.length > 0 ? (
                                                    <Table>
                                                        <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-center">Qty</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
                                                        <TableBody>
                                                            {staff.totalSoldItems.map((item, index) => (
                                                                <TableRow key={index}><TableCell>{item.name}</TableCell><TableCell className="text-center">{item.quantity}</TableCell><TableCell className="text-right">{formatCurrency(item.price)}</TableCell></TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                ) : <p className="text-xs text-muted-foreground">No items sold overall.</p>}
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </CollapsibleContent>
                        </Collapsible>
                    ))}
                </div>
            </CardContent>
        </Card>

        <DiscountSummary data={{
            totalDiscount: discountData.totalDiscount,
            todaysDiscount: 0, // Not applicable on this page
            discountsByStaff: discountData.discountsByStaff,
            userCurrency: currency,
            isLoading: isPageLoading,
        }} />


          <Card>
            <Tabs defaultValue="sales-profit">
                <CardHeader>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="sales-profit">Sales &amp; Profit Trend</TabsTrigger>
                        <TabsTrigger value="income">Hotel Income Trend</TabsTrigger>
                    </TabsList>
                </CardHeader>
                <CardContent>
                    <TabsContent value="sales-profit">
                         <ChartContainer config={chartConfig} className="h-72 w-full">
                            <BarChart data={monthlyPerformanceData}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                            <YAxis tickFormatter={(value) => formatCurrency(value).replace(currency, '')} />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" formatter={(value) => formatCurrency(value as number)} />}
                            />
                            <Legend />
                            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                            <Bar dataKey="profit" fill="var(--color-profit)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    </TabsContent>
                    <TabsContent value="income">
                        <ChartContainer config={chartConfig} className="h-72 w-full">
                            <BarChart data={monthlyPerformanceData}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                            <YAxis tickFormatter={(value) => formatCurrency(value).replace(currency, '')} />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" formatter={(value) => formatCurrency(value as number)} />}
                            />
                            <Legend />
                            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} name="Income" />
                            </BarChart>
                        </ChartContainer>
                    </TabsContent>
                </CardContent>
            </Tabs>
          </Card>


        <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Data &amp; Reports</CardTitle>
                    <CardDescription>Filter sales data and view reports.</CardDescription>
                </div>
                 <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handlePrint} disabled={isPrinting}>
                    {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                    Print
                  </Button>
                   <Button variant="outline" onClick={handleDownloadImage} disabled={isExporting}>
                      {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                      Download
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
                 <Tabs defaultValue="income" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="income">Income</TabsTrigger>
                        <TabsTrigger value="expenses">Expenses</TabsTrigger>
                        <TabsTrigger value="sales">Sales</TabsTrigger>
                        <TabsTrigger value="transfers">Transfers</TabsTrigger>
                        <TabsTrigger value="guest-folio">Guest Folio</TabsTrigger>
                    </TabsList>
                    <TabsContent value="income" className="mt-4">
                         <DataTable
                            columns={incomeColumns}
                            data={incomeData}
                            isPaginated={!isDateFilterActive}
                            tableId="income-report"
                        />
                    </TabsContent>
                    <TabsContent value="expenses" className="mt-4">
                         <DataTable
                            columns={expenseColumns}
                            data={filteredExpenses}
                            isPaginated={!isDateFilterActive}
                            tableId="expenses-report"
                        />
                    </TabsContent>
                     <TabsContent value="sales" className="mt-4">
                        <DataTable
                            columns={salesColumns}
                            data={transactions}
                            isPaginated={!isDateFilterActive}
                            tableId="sales-report"
                        />
                    </TabsContent>
                     <TabsContent value="transfers" className="mt-4">
                        <DataTable
                            columns={transferHistoryColumns}
                            data={transferHistory}
                            isPaginated={!isDateFilterActive}
                            tableId="transfer-history-report"
                        />
                    </TabsContent>
                    <TabsContent value="guest-folio" className="mt-4">
                        <DataTable
                            columns={guestFolioColumns}
                            data={guestFolioData}
                            isPaginated={!isDateFilterActive}
                            tableId="guest-folio-accounting"
                        />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
      </div>

       <AddEditExpenseDialog
        isOpen={isExpenseFormOpen}
        onClose={() => { setIsExpenseFormOpen(false); setExpenseToEdit(null); }}
        expense={expenseToEdit}
        onSuccess={() => {}}
        accountBalances={accountBalances}
      />
      {expenseToDelete && (
        <DeleteExpenseDialog
            isOpen={!!expenseToDelete}
            onClose={() => setExpenseToDelete(null)}
            expense={expenseToDelete}
            onSuccess={() => {}}
        />
      )}
      <ViewSaleDetailsDialog isOpen={!!saleToView} onClose={() => setSaleToView(null)} sale={saleToView} currency={currency} />
      <StockSaleReceiptDialog isOpen={!!saleToPrint} onClose={() => setSaleToPrint(null)} sale={saleToPrint} />
      {saleToRefund && <RefundSaleDialog isOpen={!!saleToRefund} onClose={() => setSaleToRefund(null)} sale={saleToRefund} onConfirm={confirmRefund} />}

      <ReprintReceiptDialog
        isOpen={!!paymentForReprint}
        onClose={() => setIncomeToPrint(null)}
        payment={paymentForReprint}
      />

       {incomeToPrint && incomeToPrint.source === 'Salon' && (
        <SalonReceiptDialog
          isOpen={!!incomeToPrint}
          onClose={() => setIncomeToPrint(null)}
          order={incomeToPrint.originalDoc}
        />
      )}

       {incomeToPrint && incomeToPrint.source === 'Stock Sales' && (
        <StockSaleReceiptDialog
          isOpen={!!incomeToPrint}
          onClose={() => setIncomeToPrint(null)}
          sale={incomeToPrint.originalDoc}
        />
      )}

      <TransferFundsDialog
        isOpen={isTransferFundsOpen}
        onClose={() => setIsTransferFundsOpen(false)}
        onSuccess={() => {}}
        accountBalances={accountBalances}
      />

      <TransferReceiptDialog
        isOpen={!!transferToPrint}
        onClose={() => setTransferToPrint(null)}
        transfer={transferToPrint}
      />

      <ExpenseReceiptDialog
        isOpen={!!expenseToPrint}
        onClose={() => setExpenseToPrint(null)}
        expense={expenseToPrint}
      />

      <Dialog open={!!actionsExpense} onOpenChange={(open) => setActionsExpense(open ? actionsExpense : null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitleComponent>Actions for Expense</DialogTitleComponent>
                <DialogDescription>
                    {actionsExpense?.description}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
                <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                        setExpenseToPrint(actionsExpense);
                        setActionsExpense(null);
                    }}
                >
                    <Printer className="mr-2 h-4 w-4" />
                    Print Receipt
                </Button>
                {actionsExpense?.status !== 'Voided' && (
                    <>
                        <Button
                            variant="outline"
                            className="justify-start"
                            onClick={() => {
                                setExpenseToEdit(actionsExpense);
                                setIsExpenseFormOpen(true);
                                setActionsExpense(null);
                            }}
                        >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Expense
                        </Button>
                        <Button
                            variant="destructive"
                            className="justify-start"
                            onClick={() => {
                                setExpenseToDelete(actionsExpense);
                                setActionsExpense(null);
                            }}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Void Expense
                        </Button>
                    </>
                )}
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setActionsExpense(null)}>Close</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog open={!!actionsSale} onOpenChange={(open) => setActionsSale(open ? actionsSale : null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitleComponent>Actions for Sale</DialogTitleComponent>
                <DialogDescription>
                  Sale ID: {(actionsSale as StockSale)?.saleId}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
                <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => { setSaleToView(actionsSale as StockSale); setActionsSale(null); }}
                >
                    <Eye className="mr-2 h-4 w-4" /> View Details
                </Button>
                <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => { setSaleToPrint(actionsSale as StockSale); setActionsSale(null); }}
                >
                    <Printer className="mr-2 h-4 w-4" /> Reprint Receipt
                </Button>
                {actionsSale?.type === 'Sale' && (
                  <Button
                      variant="destructive"
                      className="justify-start"
                      onClick={() => { setSaleToRefund(actionsSale as StockSale); setActionsSale(null); }}
                      disabled={(actionsSale as StockSale).status === 'Refunded' || !canProcessRefunds}
                  >
                      <Undo2 className="mr-2 h-4 w-4" /> Refund Sale
                  </Button>
                )}
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setActionsSale(null)}>Close</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

     <Dialog open={!!actionsTransfer} onOpenChange={(open) => !open && setActionsTransfer(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitleComponent>Actions for Transfer</DialogTitleComponent>
                <DialogDescription>
                    Transfer from {actionsTransfer?.fromAccount} to {actionsTransfer?.toAccount}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
                <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                        setTransferToPrint(actionsTransfer);
                        setActionsTransfer(null);
                    }}
                >
                    <Printer className="mr-2 h-4 w-4" />
                    Print Receipt
                </Button>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setActionsTransfer(null)}>Close</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

export default withAuth(AccountingPage, PagePermission.VIEW_ACCOUNTING_PAGE);
