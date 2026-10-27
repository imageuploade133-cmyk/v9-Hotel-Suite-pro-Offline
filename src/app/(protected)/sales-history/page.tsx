
'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, runTransaction, doc, writeBatch, serverTimestamp, getDoc, where, orderBy, getDocs, deleteDoc, increment } from 'firebase/firestore';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import type { StockItem, StockSale, StockReturn, Payment, Customer, UserProfile, HeldSale, Transaction } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { StatCard } from '@/components/ui/stat-card';
import { DollarSign, Package, Undo2, TrendingUp, Download, Loader2, CreditCard, ChevronDown, Hand, Percent, Tag as TagIcon, Search } from 'lucide-react';
import SalesHistoryLoading from './loading';
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
import { TopHeader } from '@/components/top-header';
import { Input } from '@/components/ui/input';
import { processRefund } from '@/lib/refund-service';

interface TopSoldItem {
    name: string;
    quantity: number;
    image?: string;
}

function SalesHistoryPage() {
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { userProfile } = useUser();
  const { toast } = useToast();
  const { getCollectionPath, isGlobalMode, isBranchMode, currentBranch } = useBranch();

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [isExporting, setIsExporting] = React.useState(false);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const [isStatsExpanded, setIsStatsExpanded] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const [saleToView, setSaleToView] = React.useState<StockSale | null>(null);
  const [saleToPrint, setSaleToPrint] = React.useState<StockSale | null>(null);
  const [saleToRefund, setSaleToRefund] = React.useState<StockSale | null>(null);

  const usersQuery = React.useMemo(() => firestore ? query(collection(firestore, 'users')) : null, [firestore]);
  const { data: usersData, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  const userMap = React.useMemo(() => {
    if (!usersData) return new Map();
    return new Map(usersData.map(u => [u.uid, u]));
  }, [usersData]);

  const creditPaymentsConstraints = React.useMemo(() => [where('type', '==', 'Credit Repayment')], []);

  // Branch mode queries
  const branchStockQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stock'))) : null, [firestore, isGlobalMode, getCollectionPath]);
  const branchSalesQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockSales'))) : null, [firestore, isGlobalMode, getCollectionPath]);
  const branchReturnsQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockReturns'))) : null, [firestore, isGlobalMode, getCollectionPath]);
  const branchPaymentsQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('payments')), ...creditPaymentsConstraints) : null, [firestore, isGlobalMode, getCollectionPath, creditPaymentsConstraints]);
  const branchHeldSalesQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('heldSales'))) : null, [firestore, isGlobalMode, getCollectionPath]);

  const branchStockResult = useCollection<StockItem>(branchStockQuery);
  const branchSalesResult = useCollection<StockSale>(branchSalesQuery);
  const branchReturnsResult = useCollection<StockReturn>(branchReturnsQuery);
  const branchPaymentsResult = useCollection<Payment>(branchPaymentsQuery);
  const branchHeldSalesResult = useCollection<HeldSale>(branchHeldSalesQuery);

  // Global mode queries
  const globalStockResult = useGlobalCollectionData<StockItem>('stock', []);
  const globalSalesResult = useGlobalCollectionData<StockSale>('stockSales', []);
  const globalReturnsResult = useGlobalCollectionData<StockReturn>('stockReturns', []);
  const globalPaymentsResult = useGlobalCollectionData<Payment>('payments', creditPaymentsConstraints);
  const globalHeldSalesResult = useGlobalCollectionData<HeldSale>('heldSales', []);

  // Use appropriate result based on mode
  const { data: stockItems, isLoading: areStockItemsLoading } = isGlobalMode ? globalStockResult : branchStockResult;
  const { data: sales, isLoading: areSalesLoading } = isGlobalMode ? globalSalesResult : branchSalesResult;
  const { data: returns, isLoading: areReturnsLoading } = isGlobalMode ? globalReturnsResult : branchReturnsResult;
  const { data: creditPayments, isLoading: arePaymentsLoading } = isGlobalMode ? globalPaymentsResult : branchPaymentsResult;
  const { data: heldSales, isLoading: areHeldSalesLoading } = isGlobalMode ? globalHeldSalesResult : branchHeldSalesResult;


  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const { transactionsWithPayments, summaryStats } = React.useMemo(() => {
    const safeSales = sales || [];
    const safeReturns = returns || [];
    const safeStockItems = stockItems || [];
    const safeHeldSales = heldSales || [];

    const dateFilteredSales = dateRange?.from
      ? safeSales.filter(sale => {
          const soldAt = getSafeDate(sale.soldAt);
          if (!soldAt) return false;
          const interval = {
            start: startOfDay(dateRange.from!),
            end: endOfDay(dateRange.to || dateRange.from!),
          };
          return isWithinInterval(soldAt, interval);
        })
      : safeSales;

    const dateFilteredReturns = dateRange?.from
      ? safeReturns.filter(ret => {
          const returnedAt = getSafeDate(ret.returnedAt);
          return returnedAt && isWithinInterval(returnedAt, { start: startOfDay(dateRange.from!), end: endOfDay(dateRange.to || dateRange.from!) });
        })
      : safeReturns;

    const totalSalesValue = dateFilteredSales.reduce((acc, sale) => acc + sale.totalAmount, 0);
    const totalRefundsValue = dateFilteredReturns.reduce((acc, ret) => acc + ret.totalRefundAmount, 0);
    const netRevenue = totalSalesValue - totalRefundsValue;
    const totalItemsRefunded = dateFilteredReturns.reduce((sum, r) => sum + r.items.reduce((itemSum, i) => itemSum + i.quantity, 0), 0);

    const totalCostOfGoodsSold = dateFilteredSales.reduce((acc, sale) => {
      const saleCost = sale.items.reduce((itemSum, saleItem) => {
        const stockItem = safeStockItems.find(si => si.id === saleItem.itemId);
        return itemSum + ((stockItem?.costPrice || 0) * saleItem.quantity);
      }, 0);
      return acc + saleCost;
    }, 0);

    const netProfit = totalSalesValue - totalCostOfGoodsSold;
    const itemsSold = dateFilteredSales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

    const totalOnHoldValue = safeHeldSales.reduce((sum, sale) => sum + sale.cart.reduce((cartSum, item) => cartSum + ((item.price || (item as any).sellingPrice) * (item.sellQuantity as number)), 0), 0);
    const totalOnHoldSales = safeHeldSales.length;

    const totalPromoSales = dateFilteredSales.filter(s => {
        const itemWithPromo = s.items.find(item => {
            const stockItem = safeStockItems.find(si => si.id === item.itemId);
            const promoStartDate = getSafeDate(stockItem?.promoStartDate);
            const promoEndDate = getSafeDate(stockItem?.promoEndDate);
            return promoStartDate && promoEndDate ? isWithinInterval(getSafeDate(s.soldAt)!, { start: promoStartDate, end: promoEndDate }) : false;
        });
        return !!itemWithPromo;
    }).reduce((sum, sale) => sum + sale.totalAmount, 0);

    const totalCreditSales = dateFilteredSales.filter(s => s.paymentMethod === 'Credit').reduce((sum, s) => sum + s.totalAmount, 0);
    const totalPaidSales = totalSalesValue - totalCreditSales;

    const itemsSoldMap = new Map<string, { name: string; quantity: number; image?: string }>();
    dateFilteredSales.forEach(sale => {
      sale.items.forEach(item => {
        const existing = itemsSoldMap.get(item.itemId);
        const stockItem = safeStockItems.find(si => si.id === item.itemId);
        const image = (stockItem?.images && stockItem.images.length > 0) ? stockItem.images[0] : settings?.globalStockImageUrl;
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          itemsSoldMap.set(item.itemId, { name: item.itemName, quantity: item.quantity, image });
        }
      });
    });
    const topItem = Array.from(itemsSoldMap.values()).sort((a, b) => b.quantity - a.quantity)[0] || null;

    let allTransactions: Transaction[] = [
        ...dateFilteredSales.map(s => ({ ...s, type: 'Sale' as const })),
        ...dateFilteredReturns.map(r => ({ ...r, type: 'Return' as const })),
    ].sort((a,b) => {
        const dateA = getSafeDate((a as StockSale).soldAt || (a as StockReturn).returnedAt)!;
        const dateB = getSafeDate((b as StockSale).soldAt || (b as StockReturn).returnedAt)!;
        return dateB.getTime() - dateA.getTime();
    });

    if (searchTerm) {
        const lowerCaseSearch = searchTerm.toLowerCase();
        allTransactions = allTransactions.filter(t => {
            if (t.type === 'Sale') {
                return ((t as StockSale).customerName || '').toLowerCase().includes(lowerCaseSearch) || (t as StockSale).saleId.toLowerCase().includes(lowerCaseSearch);
            }
            if (t.type === 'Return') {
                return ((t as StockReturn).customerName || '').toLowerCase().includes(lowerCaseSearch) || (t as StockReturn).refundId.toLowerCase().includes(lowerCaseSearch);
            }
            return false;
        });
    }

    const transactionsWithData = allTransactions.map(t => {
        if (t.type === 'Sale' && t.paymentMethod === 'Credit') {
            const sale = t as StockSale & { amountPaid?: number };
            const repaymentsForSale = (creditPayments || []).filter(p => p.bookingId === sale.id);
            const totalRepaid = repaymentsForSale.reduce((sum, p) => sum + p.amount, 0);
            return { ...t, amountPaid: totalRepaid + (sale.initialPaymentAmount || 0) };
        }
        return t;
    });

    return {
      transactionsWithPayments: transactionsWithData,
      summaryStats: {
        netRevenue,
        netProfit,
        totalRefunds: totalRefundsValue,
        totalItemsRefunded,
        itemsSold,
        totalOnHoldValue,
        totalOnHoldSales,
        totalPromoSales,
        topSoldItem: topItem,
        totalCreditSales,
        totalPaidSales,
      },
    };
  }, [sales, returns, stockItems, dateRange, creditPayments, heldSales, settings?.globalStockImageUrl, searchTerm]);

  const handleRefund = (sale: StockSale) => {
    setSaleToRefund(sale);
  };

  const onReprintReceipt = (sale: StockSale) => {
    setSaleToPrint(sale);
  };

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
        setReloadCounter(c => c + 1);
    } else {
        toast({
            variant: 'destructive',
            title: 'Refund Failed',
            description: result.error || 'Failed to process refund'
        });
        throw new Error(result.error || 'Failed to process refund');
    }
  };

  const handleExport = () => {
    if (transactionsWithPayments.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'No transactions to export for the selected period.'});
      return;
    }
    setIsExporting(true);
    toast({ title: 'Exporting Data', description: 'Your transaction history is being prepared.' });
    try {
        const dataToExport = transactionsWithPayments.map(t => {
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
      exportToCsv(dataToExport, `sales-history-${new Date().toISOString().split('T')[0]}.csv`);
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
      userMap,
      sales,
      creditPayments,
      returns,
      dateRange: dateRange,
      searchTerm: searchTerm
  });


  if (isLoading) {
    return <SalesHistoryLoading />;
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
          <TopHeader
            name="Sales History"
            icon={<TrendingUp />}
            description={isBranchMode ? `Branch: ${currentBranch?.name}` : "A complete record of all sales and returns from your inventory."}
          />
           <div className="flex items-center gap-2">
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
             <Button onClick={handleExport} disabled={isLoading || isExporting} className="w-full sm:w-auto">
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
          </div>
        </div>

        <Collapsible open={isStatsExpanded} onOpenChange={setIsStatsExpanded}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Net Revenue"
                    value={formatCurrency(summaryStats.netRevenue)}
                    icon={DollarSign}
                    description="Total sales minus refunds for the period."
                    className="border-green-500 text-green-500"
                />
                <StatCard
                    title="Net Profit"
                    value={formatCurrency(summaryStats.netProfit)}
                    icon={TrendingUp}
                    description="Revenue minus cost of goods sold for the period."
                />
                <StatCard
                    title="Items Sold"
                    value={summaryStats.itemsSold.toLocaleString()}
                    icon={Package}
                    description="Total units sold in the period."
                />
                 <StatCard
                    title="Total Refunds"
                    value={formatCurrency(summaryStats.totalRefunds)}
                    icon={Undo2}
                    description={`From ${summaryStats.totalItemsRefunded} items in the period.`}
                    className="border-destructive text-destructive"
                />
            </div>

             <CollapsibleContent className="grid animate-in fade-in-0 zoom-in-95 gap-4 pt-4 md:grid-cols-2 lg:grid-cols-4">
                 <StatCard
                    title="Value of Running Tables"
                    value={formatCurrency(summaryStats.totalOnHoldValue)}
                    icon={Hand}
                    description={`Across ${summaryStats.totalOnHoldSales} active table(s).`}
                    className="text-yellow-600 border-yellow-500"
                />
                 <StatCard
                    title="Total Promo Sales"
                    value={formatCurrency(summaryStats.totalPromoSales)}
                    icon={Percent}
                    description="Total revenue from sales with promotions applied."
                />
                 {summaryStats.topSoldItem && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Top Selling Item</CardTitle>
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
                    title="Total Credit vs Paid"
                    value={formatCurrency(summaryStats.totalCreditSales)}
                    icon={CreditCard}
                    description={`On credit vs ${formatCurrency(summaryStats.totalPaidSales)} paid upfront.`}
                    className={summaryStats.totalCreditSales > 0 ? "border-destructive text-destructive" : "border-green-500 text-green-500"}
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
                  <CardTitle>Transactions</CardTitle>
                  <CardDescription>
                      A list of all sales and returns within the selected period.
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
                    data={transactionsWithPayments}
                    tableId="sales-history"
                />
            </CardContent>
          </Card>
      </div>
      <StockSaleReceiptDialog
        isOpen={!!saleToPrint}
        onClose={() => setSaleToPrint(null)}
        sale={saleToPrint}
      />
      {saleToRefund && <RefundSaleDialog isOpen={!!saleToRefund} onClose={() => setSaleToRefund(null)} sale={saleToRefund} onConfirm={confirmRefund} />}
      <ViewSaleDetailsDialog isOpen={!!saleToView} onClose={() => setSaleToView(null)} sale={saleToView} currency={currency} />
    </>
  );
}

export default withAuth(SalesHistoryPage, PagePermission.VIEW_SALES_REPORTS);
