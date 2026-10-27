
'use client';

import * as React from 'react';
import {
  collection,
  query,
  onSnapshot,
  doc,
  serverTimestamp,
  orderBy,
  runTransaction,
  addDoc,
  deleteDoc,
  updateDoc,
  increment,
  getDocs,
  where,
  writeBatch,
  Timestamp,
  getDoc,
} from 'firebase/firestore';
import { Package, Plus, DollarSign, TrendingUp, ShoppingBag, CalendarCheck, Hand, ChevronDown, AlertTriangle, XCircle, MessageSquareText, ConciergeBell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StockItem, StockSale, HeldSale, ServiceItem } from '@/lib/types';
import { StockList } from '@/components/stock/stock-list';
import { AddEditStockItemDialog } from '@/components/stock/add-edit-stock-item-dialog';
import { DeleteStockItemDialog } from '@/components/stock/delete-stock-item-dialog';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import { useSettings } from '@/contexts/settings-context';
import { StatCard } from '@/components/ui/stat-card';
import { isToday, startOfDay, endOfDay, isWithinInterval, format, isPast, addDays } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { SendStockReportDialog } from '@/components/stock/send-stock-report-dialog';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import Link from 'next/link';
import { OnHoldSalesByUser } from '@/components/stock/on-hold-sales-by-user';
import { TopHeader } from '@/components/top-header';
import { TransferLogSummary } from '@/components/stock/transfer-log-summary';
import { useBranch } from '@/contexts/branch-context';

function StockManagementPage() {
  const [isItemFormOpen, setIsItemFormOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<StockItem | null>(null);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const [isStatsExpanded, setIsStatsExpanded] = React.useState(false);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [isReportDialogOpen, setIsReportDialogOpen] = React.useState(false);

  const firestore = useFirestore();
  const { settings, isLoading: areSettingsLoading } = useSettings();
  const { toast } = useToast();
  const { getCollectionPath, currentBranch, isBranchMode, isGlobalMode } = useBranch();

  // --- Branch / POS mode queries (only active when NOT global) ---
  const branchStockQuery = useMemoFirebase(
    () => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stock'))) : null,
    [firestore, isGlobalMode, getCollectionPath, reloadCounter]
  );
  const branchSalesQuery = useMemoFirebase(
    () => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockSales'))) : null,
    [firestore, isGlobalMode, getCollectionPath, reloadCounter]
  );
  const branchHeldSalesQuery = useMemoFirebase(
    () => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('heldSales'))) : null,
    [firestore, isGlobalMode, getCollectionPath, reloadCounter]
  );

  const branchStockResult = useCollection<StockItem>(branchStockQuery);
  const branchSalesResult = useCollection<StockSale>(branchSalesQuery);
  const branchHeldSalesResult = useCollection<HeldSale>(branchHeldSalesQuery);

  // --- Global mode queries (aggregates all branches + root) ---
  const globalStockResult = useGlobalCollectionData<StockItem>('stock');
  const globalSalesResult = useGlobalCollectionData<StockSale>('stockSales');
  const globalHeldSalesResult = useGlobalCollectionData<HeldSale>('heldSales');

  // Pick the right data source based on mode
  const stockItems = isGlobalMode ? globalStockResult.data : branchStockResult.data;
  const sales = isGlobalMode ? globalSalesResult.data : branchSalesResult.data;
  const heldSales = isGlobalMode ? globalHeldSalesResult.data : branchHeldSalesResult.data;

  const areStockItemsLoading = isGlobalMode ? globalStockResult.isLoading : branchStockResult.isLoading;
  const areSalesLoading = isGlobalMode ? globalSalesResult.isLoading : branchSalesResult.isLoading;
  const areHeldSalesLoading = isGlobalMode ? globalHeldSalesResult.isLoading : branchHeldSalesResult.isLoading;

  const currency = settings?.currency || 'USD';
  const expiryAlertDays = settings?.expiryAlertDays ?? 30;

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const stats = React.useMemo(() => {
    const safeSales = sales || [];
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

    const totalProducts = safeStockItems.length;
    const totalStock = safeStockItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalSoldStock = dateFilteredSales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const totalInventoryValue = safeStockItems.reduce((sum, item) => sum + ((item.costPrice || 0) * item.quantity), 0);

    const totalRevenue = dateFilteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0);

    const totalCostOfGoodsSold = dateFilteredSales.reduce((sum, sale) => {
        const saleCost = sale.items.reduce((itemSum, saleItem) => {
            const stockItem = safeStockItems.find(si => si.id === saleItem.itemId);
            return itemSum + ((stockItem?.costPrice || 0) * saleItem.quantity);
        }, 0);
        return sum + saleCost;
    }, 0);

    const totalProfit = totalRevenue - totalCostOfGoodsSold;

    const valueOfHeldStock = safeHeldSales.reduce((sum, sale) => sum + sale.cart.reduce((cartSum, item) => cartSum + (item.sellingPrice * (item.sellQuantity as number)), 0), 0);

    const todaysSales = safeSales.filter(sale => {
      const soldAt = getSafeDate(sale.soldAt);
      return soldAt && isToday(soldAt);
    });

    const todaysSalesRevenue = todaysSales.reduce((sum, sale) => sum + sale.totalAmount, 0);

    let salesRevenueLabel = "Today's Sales Revenue";
    let salesRevenueValue = todaysSalesRevenue;
    if (dateRange?.from) {
        salesRevenueLabel = `Filtered Sales Revenue (${format(dateRange.from, "LLL dd")} - ${format(dateRange.to || dateRange.from, "LLL d")})`;
        salesRevenueValue = totalRevenue;
    }

    const now = new Date();
    const expiryThresholdDate = addDays(now, expiryAlertDays);

    let expiredCount = 0;
    let upcomingExpiryCount = 0;

    const lowStockItems = safeStockItems.filter(item => item.quantity > 0 && item.quantity <= (item.lowStockThreshold || 0));
    const outOfStockItems = safeStockItems.filter(item => item.quantity <= 0);

    safeStockItems.forEach(item => {
        const expiryDate = getSafeDate(item.expiryDate);
        if (expiryDate) {
            if (isPast(expiryDate)) {
                expiredCount++;
            } else if (isWithinInterval(expiryDate, { start: now, end: expiryThresholdDate })) {
                upcomingExpiryCount++;
            }
        }
    });


    return {
      totalProducts,
      totalStock,
      totalSoldStock,
      totalInventoryValue: formatCurrency(totalInventoryValue),
      totalProfit: formatCurrency(totalProfit),
      valueOfHeldStock: formatCurrency(valueOfHeldStock),
      salesRevenueLabel,
      salesRevenueValue: formatCurrency(salesRevenueValue),
      expiredItems: expiredCount,
      upcomingExpiryItems: upcomingExpiryCount,
      lowStockItems,
      outOfStockItems
    };
  }, [stockItems, sales, heldSales, currency, dateRange, expiryAlertDays]);

  const isLoading = areStockItemsLoading || areSalesLoading || areSettingsLoading || areHeldSalesLoading;

  const handleSuccess = () => {
    setReloadCounter(prev => prev + 1);
  };

  const handleEdit = (item: StockItem) => {
    setSelectedItem(item);
    setIsItemFormOpen(true);
  };

  const handleDelete = (item: StockItem) => {
    setSelectedItem(item);
    setIsDeleteOpen(true);
  };

  const handleCloseDialogs = () => {
    setSelectedItem(null);
    setIsItemFormOpen(false);
    setIsDeleteOpen(false);
  };

   const generateReportMessage = () => {
    const header = `*Stock Report - ${format(new Date(), 'PPp')}*`;
    const summary = `
    *Summary*
    - Total Products: ${stats.totalProducts}
    - Total Stock Items: ${stats.totalStock}
    - Total Inventory Value: *${stats.totalInventoryValue}*
    - Gross Profit (Period): *${stats.totalProfit}*
    `;

    const lowStock = stats.lowStockItems.length > 0
      ? `\n*Low Stock Alerts (${stats.lowStockItems.length})*\n` + stats.lowStockItems.map(item => `- ${item.name}: ${item.quantity} left`).join('\n')
      : '\n_No low stock items._';

    const outOfStock = stats.outOfStockItems.length > 0
      ? `\n*Out of Stock (${stats.outOfStockItems.length})*\n` + stats.outOfStockItems.map(item => `- ${item.name}`).join('\n')
      : '\n_No items are out of stock._';

    return `${header}\n${summary}\n${lowStock}\n${outOfStock}`;
  };

  const handleSendReport = async (phone: string) => {
    const message = generateReportMessage();
    const result = await sendWhatsAppMessage({
        phone: phone,
        message: message,
        senderName: settings?.businessName || 'System',
        greeting: 'Stock Report'
    });

    if (result.status === 'success') {
      toast({
        variant: 'success',
        title: 'Report Sent',
        description: `The stock report has been sent to ${phone}.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to Send Report',
        description: result.message,
      });
    }
  };


  return (
    <>
      <div className="h-full flex-col gap-6 flex">
        <div className="flex items-center justify-between">
          <TopHeader
            icon={<Package className="h-10 w-10" />}
            name={isBranchMode && currentBranch ? `${currentBranch.name} — Stock Management` : 'Global Stock Management'}
            description={isBranchMode && currentBranch ? `Isolated inventory for the ${currentBranch.name} branch.` : 'The main inventory shared across the default POS and all hotel services.'}
          />
          <div className="flex items-center gap-2">
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
             <Button variant="outline" onClick={() => setIsReportDialogOpen(true)}>
              <MessageSquareText className="mr-2 h-4 w-4" />
              Send Report
            </Button>
            <Button asChild>
              <Link href="/services">
                <ConciergeBell className="mr-2 h-4 w-4" />
                Manage Services & Foods
              </Link>
            </Button>
            <Button onClick={() => { setSelectedItem(null); setIsItemFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add New Stock Item
            </Button>
          </div>
        </div>

        <OnHoldSalesByUser globalHeldSales={isGlobalMode ? (heldSales ?? undefined) : undefined} />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <Collapsible open={isStatsExpanded} onOpenChange={setIsStatsExpanded}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Package} title="Total Products" value={stats.totalProducts} description="Number of unique product types." />
              <StatCard icon={Package} title="Total Stock Items" value={stats.totalStock} description="Total units of all items currently in stock." />
              <StatCard icon={ShoppingBag} title="Total Stock Sold" value={stats.totalSoldStock} description="Total units of all items sold in period." />
              <StatCard icon={DollarSign} title="Total Inventory Value" value={stats.totalInventoryValue} description="Based on the cost price of all stock items." />
            </div>
            <CollapsibleContent className="grid animate-in fade-in-0 zoom-in-95 gap-4 pt-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={TrendingUp} title="Gross Profit" value={stats.totalProfit} description="Total revenue minus the cost of goods sold for period." className="bg-green-100 dark:bg-green-900/50" />
              <StatCard icon={Hand} title="Value of Running Tables Stock" value={stats.valueOfHeldStock} description="Total selling price of all items in running tables." className="text-yellow-600 border-yellow-500" />
              <StatCard icon={CalendarCheck} title={stats.salesRevenueLabel} value={stats.salesRevenueValue} description="Total revenue from sales made." />
               <StatCard
                    icon={XCircle}
                    title="Total Expired Items"
                    value={stats.expiredItems}
                    description="Items that have passed their expiry date."
                    className="border-destructive text-destructive"
                />
                <StatCard
                    icon={AlertTriangle}
                    title="Upcoming Expiry"
                    value={stats.upcomingExpiryItems}
                    description={`Items expiring within the next ${expiryAlertDays} days.`}
                    className="border-yellow-500 text-yellow-600"
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
        )}

        <TransferLogSummary />

        <StockList
            onEdit={handleEdit}
            onDelete={handleDelete}
            reloadCounter={reloadCounter}
            stockCollection={getCollectionPath('stock')}
            globalData={isGlobalMode ? (stockItems ?? undefined) : undefined}
            globalLoading={isGlobalMode ? areStockItemsLoading : undefined}
        />
      </div>
      <AddEditStockItemDialog
        isOpen={isItemFormOpen}
        onClose={handleCloseDialogs}
        item={selectedItem}
        onSuccess={handleSuccess}
        stockCollection={getCollectionPath('stock')}
      />
      {selectedItem && (
        <DeleteStockItemDialog
            isOpen={isDeleteOpen}
            onClose={handleCloseDialogs}
            item={selectedItem}
            onSuccess={handleSuccess}
            stockCollection={getCollectionPath('stock')}
        />
      )}
      <SendStockReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        onSend={handleSendReport}
        defaultPhoneNumber={settings?.stockAlertPhoneNumber}
      />
    </>
  );
}

export default withAuth(StockManagementPage, PagePermission.VIEW_STOCK_MANAGEMENT);
