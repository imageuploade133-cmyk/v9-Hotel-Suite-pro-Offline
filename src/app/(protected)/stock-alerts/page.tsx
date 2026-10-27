
'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { StockItem, StockSale } from '@/lib/types';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, XCircle, Package, MessageSquareText } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { getStockAlertColumns } from '@/components/stock/stock-alert-columns';
import { EmptyState } from '@/components/ui/empty-state';
import StockAlertsLoading from './loading';
import { StatCard } from '@/components/ui/stat-card';
import { useSettings } from '@/contexts/settings-context';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useBranch } from '@/contexts/branch-context';
import { TopHeader } from '@/components/top-header';
import { Button } from '@/components/ui/button';
import { SendStockReportDialog } from '@/components/stock/send-stock-report-dialog';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { getSafeDate } from '@/lib/helpers';


function StockAlertsPage() {
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { toast } = useToast();
  const { settings } = useSettings();
  const { getCollectionPath, isGlobalMode, isBranchMode, currentBranch } = useBranch();

  const [quantities, setQuantities] = React.useState<Record<string, string>>({});
  const [savingStates, setSavingStates] = React.useState<Record<string, boolean>>({});
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const [isReportDialogOpen, setIsReportDialogOpen] = React.useState(false);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const stockConstraints = React.useMemo(() => [orderBy('name')], []);
  const salesConstraints = React.useMemo(() => [orderBy('soldAt', 'desc')], []);

  // Branch mode queries
  const branchStockQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stock')), ...stockConstraints) : null, [firestore, isGlobalMode, getCollectionPath, stockConstraints]);
  const branchSalesQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockSales')), ...salesConstraints) : null, [firestore, isGlobalMode, getCollectionPath, salesConstraints]);

  const branchStockResult = useCollection<StockItem>(branchStockQuery);
  const branchSalesResult = useCollection<StockSale>(branchSalesQuery);

  // Global mode queries
  const globalStockResult = useGlobalCollectionData<StockItem>('stock', stockConstraints);
  const globalSalesResult = useGlobalCollectionData<StockSale>('stockSales', salesConstraints);

  // Use appropriate result based on mode
  const { data: stockItems, isLoading: areStockItemsLoading } = isGlobalMode ? globalStockResult : branchStockResult;
  const { data: sales, isLoading: areSalesLoading } = isGlobalMode ? globalSalesResult : branchSalesResult;

  const { lowStockItems, outOfStockItems } = React.useMemo(() => {
    if (!stockItems) return { lowStockItems: [], outOfStockItems: [] };

    const low = stockItems.filter(item => item.quantity > 0 && item.quantity <= (item.lowStockThreshold || 0));
    const out = stockItems.filter(item => item.quantity <= 0);

    return { lowStockItems: low, outOfStockItems: out };
  }, [stockItems]);

  const generateReportMessage = (reportDateRange?: DateRange) => {
    const today = new Date();
    const start = reportDateRange?.from ? startOfDay(reportDateRange.from) : startOfDay(today);
    const end = reportDateRange?.to ? endOfDay(reportDateRange.to) : endOfDay(today);

    const filteredSales = (sales || []).filter(sale => {
        const soldAt = getSafeDate(sale.soldAt);
        return soldAt && isWithinInterval(soldAt, { start, end });
    });

    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalItemsSold = filteredSales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, i) => itemSum + i.quantity, 0), 0);

    const itemSales = new Map<string, { name: string, quantity: number, revenue: number }>();
    filteredSales.forEach(sale => {
        sale.items.forEach(item => {
            const existing = itemSales.get(item.itemId);
            const revenue = item.sellingPrice * item.quantity;
            if (existing) {
                existing.quantity += item.quantity;
                existing.revenue += revenue;
            } else {
                itemSales.set(item.itemId, { name: item.itemName, quantity: item.quantity, revenue });
            }
        });
    });

    const topSellingItems = Array.from(itemSales.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: settings?.currency || 'USD' }).format(value);

    const dateRangeStr = reportDateRange?.from
        ? `${format(reportDateRange.from, 'PP')} to ${format(reportDateRange.to || reportDateRange.from, 'PP')}`
        : format(today, 'PP');

    let report = `*Stock & Sales Report for ${dateRangeStr}*\n\n`;
    report += `*Sales Summary:*\n`;
    report += `- Total Revenue: *${formatCurrency(totalRevenue)}*\n`;
    report += `- Total Items Sold: *${totalItemsSold}*\n\n`;

    if (topSellingItems.length > 0) {
        report += `*Top 5 Selling Items:*\n` + topSellingItems.map(item => `- ${item.name}: ${item.quantity} sold (${formatCurrency(item.revenue)})`).join('\n') + '\n\n';
    }

    report += `*Current Stock Alerts:*\n`;
    if (lowStockItems.length > 0) {
        report += `\n*Low Stock Items (${lowStockItems.length})*\n` + lowStockItems.map(item => `- ${item.name}: ${item.quantity} left`).join('\n');
    }
    if (outOfStockItems.length > 0) {
        report += `\n*Out of Stock Items (${outOfStockItems.length})*\n` + outOfStockItems.map(item => `- ${item.name}`).join('\n');
    }
    if (lowStockItems.length === 0 && outOfStockItems.length === 0) {
        report += `_All items are currently in sufficient stock._`;
    }

    return report;
  };


  const handleSendReport = async (phone: string, reportDateRange?: DateRange) => {
    if (!firestore) return;
    const message = generateReportMessage(reportDateRange);
    const result = await sendWhatsAppMessage({
        phone,
        message,
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

  const columns = React.useMemo(() => getStockAlertColumns({
    quantities,
    onQuantityChange: () => {},
    onRestock: () => {},
    savingStates,
    useGlobalStockImage: settings?.useGlobalStockImage,
    globalStockImageUrl: settings?.globalStockImageUrl,
  }), [quantities, savingStates, settings]);

  const isLoading = areStockItemsLoading || areSalesLoading;

  if (isLoading) {
    return <StockAlertsLoading />;
  }

  return (
    <>
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
          <TopHeader
        name="Stock Alerts"
        icon={<AlertTriangle />}
        description={isBranchMode ? `Branch: ${currentBranch?.name}` : "Monitor and manage items that are running low or are out of stock."}
      />
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsReportDialogOpen(true)}>
                <MessageSquareText className="mr-2 h-4 w-4" />
                Send Report
            </Button>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
            title="Total Low Stock Items"
            value={lowStockItems.length}
            icon={AlertTriangle}
            description="Items that have reached their low stock threshold."
            className="border-yellow-500 text-yellow-600"
        />
        <StatCard
            title="Total Out of Stock Items"
            value={outOfStockItems.length}
            icon={XCircle}
            description="Items with zero quantity."
            className="border-destructive text-destructive"
        />
      </div>

      <Tabs defaultValue="low-stock" className="w-full">
        <TabsList>
          <TabsTrigger value="low-stock">
            Low Stock
            <Badge variant={lowStockItems.length > 0 ? 'warning' : 'secondary'} className="ml-2">{lowStockItems.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="out-of-stock">
            Out of Stock
            <Badge variant={outOfStockItems.length > 0 ? 'destructive' : 'secondary'} className="ml-2">{outOfStockItems.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="low-stock">
            {lowStockItems.length > 0 ? (
                <DataTable
                    columns={columns}
                    data={lowStockItems}
                    tableId="low-stock-table"
                    filterColumn="name"
                    filterPlaceholder="Filter low stock items..."
                />
            ) : (
                <EmptyState
                    icon={Package}
                    title="No Low Stock Items"
                    description="All items are currently above their low stock threshold."
                />
            )}
        </TabsContent>
        <TabsContent value="out-of-stock">
           {outOfStockItems.length > 0 ? (
                <DataTable
                    columns={columns}
                    data={outOfStockItems}
                    tableId="out-of-stock-table"
                    filterColumn="name"
                    filterPlaceholder="Filter out of stock items..."
                />
            ) : (
                <EmptyState
                    icon={Package}
                    title="No Items Out of Stock"
                    description="All items are currently in stock."
                />
            )}
        </TabsContent>
      </Tabs>
    </div>
    <SendStockReportDialog
      isOpen={isReportDialogOpen}
      onClose={() => setIsReportDialogOpen(false)}
      onSend={handleSendReport}
      defaultPhoneNumber={settings?.stockAlertPhoneNumber}
    />
    </>
  );
}

export default withAuth(StockAlertsPage, PagePermission.VIEW_STOCK_ALERTS);
