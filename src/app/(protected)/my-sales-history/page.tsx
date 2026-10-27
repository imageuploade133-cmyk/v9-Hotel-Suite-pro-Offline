
'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { useMemo } from 'react';
import { collection, query, runTransaction, doc, writeBatch, serverTimestamp, getDoc, where, orderBy, getDocs, deleteDoc, increment } from 'firebase/firestore';
import type { StockItem, StockSale, StockReturn, Payment, Customer, UserProfile, HeldSale, Transaction } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { StatCard } from '@/components/ui/stat-card';
import { DollarSign, Package, Undo2, TrendingUp, Download, Loader2, CreditCard, ChevronDown, Hand, Percent, Tag as TagIcon, ArrowLeft, Search, Wallet, Receipt, RotateCcw, Printer } from 'lucide-react';
import MySalesHistoryLoading from './loading';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { getSafeDate } from '@/lib/helpers';
import { isWithinInterval, startOfDay, endOfDay, format, isToday } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { exportToCsv } from '@/lib/csv-export';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/ui/data-table';
import { useSalesHistoryColumns } from '@/components/sales-history/columns';
import { StockSaleReceiptDialog } from '@/components/stock/stock-sale-receipt-dialog';
import { RefundSaleDialog } from '@/components/stock/refund-sale-dialog';
import { useUser } from '@/contexts/user-context';
import { ViewSaleDetailsDialog } from '@/components/stock/view-sale-details-dialog';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { TopHeader } from '@/components/top-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { RecordCreditPaymentDialog } from '@/components/stock/record-credit-payment-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TopSoldItem {
    name: string;
    quantity: number;
    image?: string;
}


function MySalesHistoryPage() {
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { userProfile, user } = useUser();
  const { toast } = useToast();
  const { getCollectionPath, isBranchMode, currentBranch } = useBranch();

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [isExporting, setIsExporting] = React.useState(false);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const [isStatsExpanded, setIsStatsExpanded] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const [saleToView, setSaleToView] = React.useState<StockSale | null>(null);
  const [saleToPrint, setSaleToPrint] = React.useState<StockSale | null>(null);
  const [saleToRefund, setSaleToRefund] = React.useState<StockSale | null>(null);
  const [saleToRecordPayment, setSaleToRecordPayment] = React.useState<StockSale | null>(null);
  const [actionsSale, setActionsSale] = React.useState<StockSale | null>(null);
  const [activeTab, setActiveTab] = React.useState<'all' | 'credit'>('all');

  const usersQuery = useMemo(() => firestore ? query(collection(firestore, 'users')) : null, [firestore]);
  const { data: usersData, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  const userMap = React.useMemo(() => {
    if (!usersData) return new Map();
    return new Map(usersData.map(u => [u.uid, u]));
  }, [usersData]);

  const stockItemsQuery = useMemo(() => firestore ? query(collection(firestore, getCollectionPath('stock'))) : null, [firestore, reloadCounter, getCollectionPath]);

  const salesQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, getCollectionPath('stockSales')),
        where('soldByUid', '==', user.uid)
    );
  }, [firestore, user, reloadCounter, getCollectionPath]);

  const returnsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, getCollectionPath('stockReturns')),
        where('returnedByUid', '==', user.uid)
    );
  }, [firestore, user, reloadCounter, getCollectionPath]);

  const paymentsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, getCollectionPath('payments')),
        where('type', '==', 'Credit Repayment')
    );
  }, [firestore, reloadCounter, getCollectionPath]);

  const heldSalesQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, getCollectionPath('heldSales')),
        where('heldByUid', '==', user.uid)
    );
  }, [firestore, user, reloadCounter, getCollectionPath]);

  const { data: stockItems, isLoading: areStockItemsLoading } = useCollection<StockItem>(stockItemsQuery);
  const { data: sales, isLoading: areSalesLoading } = useCollection<StockSale>(salesQuery);
  const { data: returns, isLoading: areReturnsLoading } = useCollection<StockReturn>(returnsQuery);
  const { data: creditPayments, isLoading: arePaymentsLoading } = useCollection<Payment>(paymentsQuery);
  const { data: heldSales, isLoading: areHeldSalesLoading } = useCollection<HeldSale>(heldSalesQuery);

  // Filter sales based on active tab
  const filteredSales = React.useMemo(() => {
    if (!sales) return [];
    if (activeTab === 'credit') {
      return sales.filter(s => s.paymentMethod === 'Credit');
    }
    return sales;
  }, [sales, activeTab]);


  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const mySales = filteredSales || [];
  const myReturns = returns || [];

  // Credit sales statistics
  const creditStats = React.useMemo(() => {
    const myCreditSales = (sales || []).filter(s => s.paymentMethod === 'Credit');

    const totalCreditSales = myCreditSales.reduce((sum, s) => sum + s.totalAmount, 0);

    // Calculate total repaid from credit payments linked to my sales
    const myCreditSaleIds = new Set(myCreditSales.map(s => s.id));
    const myRepayments = (creditPayments || []).filter(p =>
      myCreditSaleIds.has(p.bookingId || '')
    );
    const totalRepaid = myRepayments.reduce((sum, p) => sum + p.amount, 0) +
      myCreditSales.reduce((sum, s) => sum + (s.initialPaymentAmount || 0), 0);

    const outstandingBalance = totalCreditSales - totalRepaid;

    const todaysCreditSales = myCreditSales.filter(s => {
      const soldAt = getSafeDate(s.soldAt);
      return soldAt && isToday(soldAt);
    }).reduce((sum, s) => sum + s.totalAmount, 0);

    const paidOffCount = myCreditSales.filter(s => {
      const repayments = (creditPayments || []).filter(p => p.bookingId === s.id);
      const totalRepaidForSale = repayments.reduce((sum, p) => sum + p.amount, 0) + (s.initialPaymentAmount || 0);
      return totalRepaidForSale >= s.totalAmount;
    }).length;

    return {
      totalCreditSales,
      totalRepaid,
      outstandingBalance,
      todaysCreditSales,
      totalCount: myCreditSales.length,
      paidOffCount,
      pendingCount: myCreditSales.length - paidOffCount,
    };
  }, [sales, creditPayments]);

  const summaryStats = React.useMemo(() => {
    // Global stats for the cards (based on ALL of the user's data, not filtered by date/search)
    const myTodaysSalesValue = mySales.filter(s => {
        const soldAt = getSafeDate(s.soldAt);
        return soldAt && isToday(soldAt);
    }).reduce((sum, s) => {
        // Get all refunds for this sale
        const saleRefunds = (myReturns || []).filter(r => r.originalSaleId === s.id);
        const totalRefunded = saleRefunds.reduce((refSum, r) => refSum + r.totalRefundAmount, 0);
        return sum + (s.totalAmount - totalRefunded);
    }, 0);

    // Calculate total sales value minus refunds (for accurate net sales)
    const myTotalSalesValue = mySales
        .filter(s => s.status !== 'Refunded')
        .reduce((sum, s) => {
            // Get all refunds for this sale
            const saleRefunds = (myReturns || []).filter(r => r.originalSaleId === s.id);
            const totalRefunded = saleRefunds.reduce((refSum, r) => refSum + r.totalRefundAmount, 0);
            return sum + (s.totalAmount - totalRefunded);
        }, 0);

    const myTotalItemsSoldValue = mySales.reduce((sum, s) => sum + s.items.reduce((itemSum, i) => itemSum + i.quantity, 0), 0);

    const myTotalCreditSalesValue = mySales.filter(s => s.paymentMethod === 'Credit').reduce((sum, s) => sum + s.totalAmount, 0);
    const myTotalPaidSalesValue = myTotalSalesValue - myTotalCreditSalesValue;

    const myTotalOnHoldSalesCount = (heldSales || []).length;
    const myTotalOnHoldValueNum = (heldSales || []).reduce((sum, sale) => sum + sale.cart.reduce((cartSum, item) => cartSum + ((item.price || 0) * (item.sellQuantity as number)), 0), 0);

    const myTotalPromoSalesValue = mySales.filter(s => {
        const itemWithPromo = s.items.find(item => {
            const stockItem = (stockItems || []).find(si => si.id === item.itemId);
            const promoStartDate = getSafeDate(stockItem?.promoStartDate);
            const promoEndDate = getSafeDate(stockItem?.promoEndDate);
            return promoStartDate && promoEndDate ? isWithinInterval(getSafeDate(s.soldAt)!, { start: promoStartDate, end: promoEndDate }) : false;
        });
        return !!itemWithPromo;
    }).reduce((sum, sale) => sum + sale.totalAmount, 0);

    const itemsSoldMap = new Map<string, { name: string; quantity: number, image?: string }>();
    mySales.forEach(sale => {
      sale.items.forEach(item => {
        const existing = itemsSoldMap.get(item.itemId);
        const stockItem = (stockItems || []).find(si => si.id === item.itemId);
        const image = (stockItem?.images && stockItem.images.length > 0) ? stockItem.images[0] : settings?.globalStockImageUrl;
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          itemsSoldMap.set(item.itemId, { name: item.itemName, quantity: item.quantity, image });
        }
      });
    });
    const topItem = Array.from(itemsSoldMap.values()).sort((a, b) => b.quantity - a.quantity)[0] || null;

    const myTotalRefundsValue = myReturns.reduce((sum, r) => sum + r.totalRefundAmount, 0);
    const myTotalItemsRefundedValue = myReturns.reduce((sum, r) => sum + r.items.reduce((itemSum, i) => itemSum + i.quantity, 0), 0);

    return {
        myTodaysSales: myTodaysSalesValue,
        myTotalSales: myTotalSalesValue,
        myTotalItemsSold: myTotalItemsSoldValue,
        myTotalCreditSales: myTotalCreditSalesValue,
        myTotalPaidSales: myTotalPaidSalesValue,
        myTotalOnHoldSales: myTotalOnHoldSalesCount,
        myTotalOnHoldValue: myTotalOnHoldValueNum,
        myTotalPromoSales: myTotalPromoSalesValue,
        topSoldItem: topItem,
        myTotalRefunds: myTotalRefundsValue,
        myTotalItemsRefunded: myTotalItemsRefundedValue,
      };
  }, [mySales, myReturns, stockItems, heldSales, settings?.globalStockImageUrl, reloadCounter]);

  const handleRefund = (sale: StockSale) => {
    setSaleToRefund(sale);
  };

  const handleRecordPayment = (sale: StockSale) => {
    setSaleToRecordPayment(sale);
  };

  const handleConfirmPayment = async (sale: StockSale, paymentAmount: number, paymentMethod: string, paymentRef: string) => {
    if (!firestore || !userProfile) {
      throw new Error('User or Firestore not available');
    }

    const batch = writeBatch(firestore);

    // 1. Create a new payment document
    const newPaymentRef = doc(collection(firestore, getCollectionPath('payments')));
    const newPaymentData: Omit<Payment, 'id'> = {
      bookingId: sale.id,
      guestName: sale.customerName || 'N/A',
      guestEmail: sale.customerEmail,
      amount: paymentAmount,
      paymentMethod: paymentMethod as any,
      status: 'Paid',
      transactionDate: new Date(),
      type: 'Credit Repayment',
      createdByUid: userProfile.uid,
      createdByName: userProfile.name,
      ...(paymentRef && { notes: paymentRef }),
    };
    batch.set(newPaymentRef, newPaymentData);

    // 2. Calculate total repaid including this new payment
    const existingRepayments = (creditPayments || []).filter(p => p.bookingId === sale.id);
    const totalExistingRepaid = existingRepayments.reduce((sum, p) => sum + p.amount, 0) + (sale.initialPaymentAmount || 0);
    const newTotalRepaid = totalExistingRepaid + paymentAmount;

    // 3. Update the sale's payment status if fully paid
    if (newTotalRepaid >= sale.totalAmount) {
      const saleRef = doc(firestore, getCollectionPath('stockSales'), sale.id);
      batch.update(saleRef, { paymentStatus: 'Paid' });

      // 4. Delete the linked running table (held sale) if it exists
      if (sale.linkedHeldSaleId) {
        const heldSaleRef = doc(firestore, getCollectionPath('heldSales'), sale.linkedHeldSaleId);
        batch.delete(heldSaleRef);
      }
    }

    await batch.commit();
    setReloadCounter(c => c + 1);
    toast({
      variant: 'success',
      title: 'Payment Recorded',
      description: `Payment of ${formatCurrency(paymentAmount)} has been recorded.`
    });
  };

  const onReprintReceipt = (sale: StockSale) => {
    setSaleToPrint(sale);
  };

  const confirmRefund = async (saleToRefund: StockSale, itemsToReturn: { itemId: string; quantity: number, itemName: string, sellingPrice: number }[], reason: string) => {
    if (!firestore || !userProfile) {
        throw new Error('User or Firestore not available.');
    }

    const totalRefundAmount = itemsToReturn.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);

    try {
        await runTransaction(firestore, async (transaction) => {
            const itemRefsAndDataPromises = itemsToReturn.map(item => {
                const itemRef = doc(firestore, getCollectionPath('stock'), item.itemId);
                return transaction.get(itemRef).then(itemDoc => ({
                    ref: itemRef,
                    doc: itemDoc,
                    returnQuantity: item.quantity
                }));
            });

            const itemRefsAndDocs = await Promise.all(itemRefsAndDataPromises);
            const saleRef = doc(firestore, getCollectionPath('stockSales'), saleToRefund.id);
            const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
            const returnRef = doc(collection(firestore, getCollectionPath('stockReturns')));
            const refundPaymentRef = doc(collection(firestore, getCollectionPath('payments')));

            const changes: { field: string, before: any, after: any }[] = [];

            // Find and update all original payments linked to this sale that are still "Paid"
            const paymentsQuery = query(
                collection(firestore, getCollectionPath('payments')),
                where('bookingId', '==', saleToRefund.id),
                where('status', '==', 'Paid')
            );
            const paymentsSnapshot = await getDocs(paymentsQuery);
            paymentsSnapshot.forEach(paymentDoc => {
                const paymentRef = doc(firestore, getCollectionPath('payments'), paymentDoc.id);
                transaction.update(paymentRef, { status: 'Refunded' });
                changes.push({
                    field: `payment ${paymentDoc.id} status`,
                    before: 'Paid',
                    after: 'Refunded'
                });
            });

            itemRefsAndDocs.forEach((item) => {
                if (!item.doc.exists()) {
                    const failedItem = itemsToReturn.find(i => i.itemId === item.ref.id);
                    throw new Error(`Stock item ${failedItem?.itemName || 'with unknown name'} not found.`);
                }
                const currentData = item.doc.data() as StockItem;
                const newQuantity = currentData.quantity + item.returnQuantity;
                transaction.update(item.ref, { quantity: newQuantity });
                changes.push({
                    field: `quantity (${item.doc.data()?.name})`,
                    before: currentData.quantity,
                    after: newQuantity
                });
            });

            const newRefundedItems = [...(saleToRefund.refundedItems || []), ...itemsToReturn.map(i => ({ itemId: i.itemId, quantity: i.quantity }))];
            const allItemsRefunded = saleToRefund.items.every(originalItem => {
                const totalRefunded = newRefundedItems.filter(rf => rf.itemId === originalItem.itemId).reduce((sum, rf) => sum + rf.quantity, 0);
                return totalRefunded >= originalItem.quantity;
            });

            const newStatus = allItemsRefunded ? 'Refunded' : 'Partially Refunded';
            transaction.update(saleRef, {
                status: newStatus,
                refundedItems: newRefundedItems
            });

            const returnData: Omit<StockReturn, 'id'> = {
                refundId: `REF-${Math.random().toString(36).substr(2, 7).toUpperCase()}`,
                originalSaleId: saleToRefund.id,
                returnedAt: serverTimestamp() as any,
                returnedByUid: userProfile.uid,
                returnedByName: userProfile.name,
                items: itemsToReturn.map(i => ({
                    itemId: i.itemId,
                    itemName: i.itemName,
                    quantity: i.quantity,
                    sellingPrice: i.sellingPrice,
                    refundAmount: i.sellingPrice * i.quantity
                })),
                totalRefundAmount,
                customerName: saleToRefund.customerName || 'Walk-in Customer',
                customerId: saleToRefund.customerId,
                reason,
            };
            transaction.set(returnRef, returnData as any);

            const refundPaymentData: Omit<Payment, 'id'> = {
                amount: totalRefundAmount,
                transactionDate: new Date(),
                paymentMethod: (saleToRefund.paymentMethod === 'Credit' ? 'Cash' : saleToRefund.paymentMethod) as any,
                status: 'Refunded',
                type: 'POS',
                createdByUid: userProfile.uid,
                createdByName: userProfile.name,
                guestName: saleToRefund.customerName || 'Walk-in Customer',
                guestEmail: saleToRefund.customerEmail || null,
                bookingId: saleToRefund.id,
                items: itemsToReturn.map(i => ({ name: i.itemName, price: i.sellingPrice, quantity: i.quantity })),
                context: saleToRefund.context === 'hotel' ? 'hotel' : 'pos',
                originalPaymentId: saleToRefund.id,
                notes: reason || null,
            };
            transaction.set(refundPaymentRef, refundPaymentData);

            transaction.set(auditLogRef, {
                timestamp: serverTimestamp(),
                userId: userProfile.uid,
                userName: userProfile.name,
                changeType: 'Refund',
                entityType: 'Stock Sale',
                entityId: saleToRefund.id,
                details: `Processed refund for ${saleToRefund.customerName}.`,
                changes: itemsToReturn.map(i => ({ field: `refunded ${i.itemName}`, before: 0, after: i.quantity })),
                notes: `Total: ${formatCurrency(totalRefundAmount)}`
            });
        });

        toast({ variant: 'success', title: 'Refund Processed', description: `Refund of ${formatCurrency(totalRefundAmount)} has been successfully processed.`});
        setReloadCounter(c => c + 1);
    } catch (err: any) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Refund Failed', description: err.message });
        throw err;
    }
  };

  const handleExport = () => {
    if (transactions.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'No transactions to export for the selected period.'});
      return;
    }
    setIsExporting(true);
    toast({ title: 'Exporting Data', description: 'Your transaction history is being prepared.' });
    try {
        const dataToExport = transactions.map(t => {
            if (t.type === 'Sale') {
                const sale = t as StockSale;
                return {
                    'ID': sale.saleId,
                    'Date': getSafeDate(sale.soldAt)?.toISOString(),
                    'Type': 'Sale',
                    'Customer': sale.customerName,
                    'Amount': sale.totalAmount,
                    'Payment Method': sale.paymentMethod,
                    'Payment Status': sale.paymentStatus,
                    'Sold By': sale.soldByName,
                    'Items': sale.items.map(i => `${i.itemName} (x${i.quantity})`).join(', '),
                }
            } else {
                const ret = t as StockReturn;
                return {
                    'ID': ret.refundId,
                    'Date': getSafeDate(ret.returnedAt)?.toISOString(),
                    'Type': 'Return',
                    'Customer': ret.customerName,
                    'Amount': -ret.totalRefundAmount,
                    'Payment Method': 'Refund',
                    'Payment Status': 'N/A',
                    'Sold By': ret.returnedByName,
                    'Items': ret.items.map(i => `${i.itemName} (x${i.quantity})`).join(', '),
                }
            }
        });
      exportToCsv(dataToExport, `my-sales-history-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Export Failed' });
    } finally {
      setIsExporting(false);
    }
  };


  const isLoading = areStockItemsLoading || areSalesLoading || areReturnsLoading || arePaymentsLoading || areUsersLoading || areHeldSalesLoading;

  const columns = useSalesHistoryColumns({
      currency,
      onViewDetails: setSaleToView,
      onReprintReceipt,
      onRefund: handleRefund,
      onRecordPayment: handleRecordPayment,
      userMap,
      sales: filteredSales,
      creditPayments,
      returns,
      dateRange: dateRange,
      searchTerm: searchTerm,
      activeTab
  });

  const getColumnsToExport = () => {
      return columns.filter(c => c.id !== 'actions' && c.id !== 'select');
  }

  const transactions = React.useMemo(() => {
    let salesToProcess = sales || [];
    let returnsToProcess = returns || [];

    if (dateRange?.from) {
        salesToProcess = salesToProcess.filter(s => {
            const soldAt = getSafeDate(s.soldAt);
            return soldAt && isWithinInterval(soldAt, { start: startOfDay(dateRange.from!), end: endOfDay(dateRange.to || dateRange.from!) });
        });
        returnsToProcess = returnsToProcess.filter(r => {
            const returnedAt = getSafeDate(r.returnedAt);
            return returnedAt && isWithinInterval(returnedAt, { start: startOfDay(dateRange.from!), end: endOfDay(dateRange.to || dateRange.from!) });
        });
    }

    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        salesToProcess = salesToProcess.filter(s => s.customerName?.toLowerCase().includes(lower) || s.saleId.toLowerCase().includes(lower));
        returnsToProcess = returnsToProcess.filter(r => r.customerName?.toLowerCase().includes(lower) || r.refundId?.toLowerCase().includes(lower));
    }

    const combined: Transaction[] = [
      ...salesToProcess.map(s => ({...s, type: 'Sale' as const})),
      ...returnsToProcess.map(r => ({...r, type: 'Return' as const}))
    ];

    return combined.sort((a,b) => {
        const dateA = getSafeDate((a as StockSale).soldAt || (a as StockReturn).returnedAt);
        const dateB = getSafeDate((b as StockSale).soldAt || (b as StockReturn).returnedAt);
        return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
    });
  }, [sales, returns, dateRange, searchTerm]);


  if (isLoading) {
    return <MySalesHistoryLoading />;
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
          <TopHeader
            name="My Sales History"
            icon={<TrendingUp />}
            description={isBranchMode ? `Branch: ${currentBranch?.name}` : undefined}
          />
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href="/pos">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to POS
              </Link>
            </Button>
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            <Button onClick={handleExport} disabled={isLoading || isExporting} className="w-full sm:w-auto">
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'credit')} className="w-full">
          <TabsList className="grid w-full sm:w-auto grid-cols-2 sm:inline-flex">
            <TabsTrigger value="all" className="gap-2">
              <Receipt className="h-4 w-4" />
              All Transactions
              <Badge variant="secondary" className="ml-1">{(sales || []).length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="credit" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Credit Sales
              <Badge variant="secondary" className="ml-1">{creditStats.totalCount}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6 space-y-6">
            <Collapsible open={isStatsExpanded} onOpenChange={setIsStatsExpanded}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="My Today's Sales"
                  value={formatCurrency(summaryStats.myTodaysSales)}
                  icon={TrendingUp}
                  description="Total revenue from your sales today."
                  className="border-green-500 text-green-500"
                />
                <StatCard
                  title="My Total Sales"
                  value={formatCurrency(summaryStats.myTotalSales)}
                  icon={DollarSign}
                  description="Your all-time total sales revenue."
                />
                <StatCard
                  title="My Total Items Sold"
                  value={summaryStats.myTotalItemsSold.toLocaleString()}
                  icon={Package}
                  description="Total units you have sold all-time."
                />
                <StatCard
                  title="My Total Credit vs Paid"
                  value={formatCurrency(summaryStats.myTotalCreditSales)}
                  icon={CreditCard}
                  description={`On credit vs ${formatCurrency(summaryStats.myTotalPaidSales)} paid upfront.`}
                  className="border-yellow-500 text-yellow-600"
                />
              </div>

              <CollapsibleContent className="grid animate-in fade-in-0 zoom-in-95 gap-4 pt-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="My Total Running Tables"
                  value={`${summaryStats.myTotalOnHoldSales} (${formatCurrency(summaryStats.myTotalOnHoldValue)})`}
                  icon={Hand}
                  description="Tables you currently have active."
                />
                <StatCard
                  title="My Total Promo Sales"
                  value={formatCurrency(summaryStats.myTotalPromoSales)}
                  icon={Percent}
                  description="Revenue from sales with promotions applied."
                />
                {summaryStats.topSoldItem && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">My Top Item</CardTitle>
                      <TagIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="flex items-center gap-4">
                      {summaryStats.topSoldItem.image && (
                        <Image src={summaryStats.topSoldItem.image} alt={summaryStats.topSoldItem.name} width={40} height={40} className="rounded-md" />
                      )}
                      <div>
                        <div className="text-lg font-bold">{summaryStats.topSoldItem.name}</div>
                        <p className="text-xs text-muted-foreground">{summaryStats.topSoldItem.quantity} units sold</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <StatCard
                  title="My Total Refunds"
                  value={formatCurrency(summaryStats.myTotalRefunds)}
                  icon={Undo2}
                  description={`${summaryStats.myTotalItemsRefunded} items returned across all your sales.`}
                  className="border-destructive text-destructive"
                />
              </CollapsibleContent>

              <div className="mt-4 flex items-center justify-center">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    {isStatsExpanded ? 'Show Less' : 'Show More Stats'}
                    <ChevronDown
                      className={cn(
                        'ml-2 h-4 w-4 transition-transform',
                        isStatsExpanded && 'rotate-180'
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </Collapsible>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>My Transactions</CardTitle>
                    <CardDescription>
                      A list of all sales and returns processed by you within the selected period.
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by customer name or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={columns}
                  data={transactions}
                  tableId="my-sales-history"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credit" className="mt-6 space-y-6">
            {/* Credit Sales Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Today's Credit Sales"
                value={formatCurrency(creditStats.todaysCreditSales)}
                icon={TrendingUp}
                description="Value of credit sales made today."
                className="border-blue-500 text-blue-500"
              />
              <StatCard
                title="Total Credit Sales"
                value={formatCurrency(creditStats.totalCreditSales)}
                icon={Wallet}
                description="Total value of all sales made on credit."
              />
              <StatCard
                title="Total Repaid"
                value={formatCurrency(creditStats.totalRepaid)}
                icon={RotateCcw}
                description="Total amount repaid towards credit sales."
                className="border-green-500 text-green-500"
              />
              <StatCard
                title="Outstanding Balance"
                value={formatCurrency(creditStats.outstandingBalance)}
                icon={DollarSign}
                description={`${creditStats.pendingCount} of ${creditStats.totalCount} sales pending payment.`}
                className={creditStats.outstandingBalance > 0 ? 'border-destructive text-destructive' : ''}
              />
            </div>

            {/* Credit Sales Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Credit Sales</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{creditStats.totalCount}</div>
                  <p className="text-xs text-muted-foreground">
                    {creditStats.paidOffCount} fully paid, {creditStats.pendingCount} pending
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {creditStats.totalCreditSales > 0
                      ? Math.round((creditStats.totalRepaid / creditStats.totalCreditSales) * 100)
                      : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Of total credit sales value collected
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Outstanding</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(creditStats.pendingCount > 0
                      ? creditStats.outstandingBalance / creditStats.pendingCount
                      : 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Per pending credit sale
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Credit Sales Table */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>My Credit Sales</CardTitle>
                    <CardDescription>
                      Manage your credit sales and record customer payments.
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by customer name or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={columns}
                  data={transactions.filter(t => t.type === 'Sale')}
                  tableId="my-credit-sales"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <StockSaleReceiptDialog
        isOpen={!!saleToPrint}
        onClose={() => setSaleToPrint(null)}
        sale={saleToPrint}
      />
      {saleToRefund && <RefundSaleDialog isOpen={!!saleToRefund} onClose={() => setSaleToRefund(null)} sale={saleToRefund} onConfirm={confirmRefund} />}
      <ViewSaleDetailsDialog isOpen={!!saleToView} onClose={() => setSaleToView(null)} sale={saleToView} currency={currency} />

      {/* Credit Payment Dialog */}
      {saleToRecordPayment && (
        <RecordCreditPaymentDialog
          isOpen={!!saleToRecordPayment}
          onClose={() => setSaleToRecordPayment(null)}
          sale={{
            ...saleToRecordPayment,
            outstandingBalance: saleToRecordPayment.totalAmount -
              ((creditPayments || []).filter(p => p.bookingId === saleToRecordPayment.id).reduce((sum, p) => sum + p.amount, 0) +
              (saleToRecordPayment.initialPaymentAmount || 0)),
            totalPaid: (creditPayments || []).filter(p => p.bookingId === saleToRecordPayment.id).reduce((sum, p) => sum + p.amount, 0) +
              (saleToRecordPayment.initialPaymentAmount || 0)
          }}
          onConfirm={handleConfirmPayment}
        />
      )}

      {/* Actions Dialog */}
      <Dialog open={!!actionsSale} onOpenChange={(open) => !open && setActionsSale(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actions for Sale #{actionsSale?.saleId}</DialogTitle>
            <DialogDescription>
              Customer: {actionsSale?.customerName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => {
                setSaleToRecordPayment(actionsSale);
                setActionsSale(null);
              }}
              disabled={actionsSale?.paymentMethod !== 'Credit'}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => {
                setSaleToPrint(actionsSale);
                setActionsSale(null);
              }}
            >
              <Printer className="mr-2 h-4 w-4" />
              Reprint Receipt
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActionsSale(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default withAuth(MySalesHistoryPage, PagePermission.VIEW_MY_SALES_HISTORY);
