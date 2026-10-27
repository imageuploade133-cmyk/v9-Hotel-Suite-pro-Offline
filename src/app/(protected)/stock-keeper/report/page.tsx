
'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { TransferLog, StockItem, StockReturn, StockSale } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { FileText, ArrowLeft, TrendingUp, DollarSign } from 'lucide-react';
import { TopHeader } from '@/components/top-header';
import { TransferReportTable } from '@/components/stock-keeper/transfer-report-table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import BulkAddLoading from '../bulk-add/loading';
import { TransferSalesBreakdownDialog } from '@/components/stock-keeper/transfer-sales-breakdown-dialog';


function TransferReportPage() {
    const firestore = useFirestore();
    const { settings } = useSettings();
    const [selectedLog, setSelectedLog] = React.useState<TransferLog | null>(null);

    const transferLogQuery = React.useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'transferLog'), orderBy('transferredAt', 'desc'));
    }, [firestore]);
    const { data: transferLogs, isLoading: areLogsLoading } = useCollection<TransferLog>(transferLogQuery);

    const stockItemsQuery = React.useMemo(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'stock'));
    }, [firestore]);
    const { data: stockItems, isLoading: areStockItemsLoading } = useCollection<StockItem>(stockItemsQuery);

    const returnsQuery = React.useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'stockReturns'));
    }, [firestore]);
    const { data: stockReturns, isLoading: areReturnsLoading } = useCollection<StockReturn>(returnsQuery);

    const salesQuery = React.useMemo(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'stockSales'));
    }, [firestore]);
    const { data: salesData, isLoading: areSalesLoading } = useCollection<StockSale>(salesQuery);

    const currency = settings?.currency || 'USD';
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

    const processedTransferLogs = React.useMemo(() => {
        if (!transferLogs || !stockItems) return [];

        const stockMap = new Map(stockItems.map(item => [item.id, item]));

        return transferLogs.map(log => {
            let totalValueSold = 0;
            let totalQuantitySold = 0;
            let totalQuantityReversed = (log.reversedItems || []).reduce((sum, ri) => sum + ri.quantity, 0);

            // This recalculates based on what has been sold from this transfer batch
            // The POS logic updates the `valueSold` and `quantitySold` on the log
            totalValueSold = log.valueSold || 0;
            totalQuantitySold = log.quantitySold || 0;

            const remainingQuantity = (log.items.reduce((sum, i) => sum + i.quantity, 0)) - totalQuantitySold - totalQuantityReversed;

            // Calculate remaining value based on current stock levels for items in this transfer
            const remainingValue = log.items.reduce((sum, item) => {
                const currentStockItem = stockMap.get(item.id);
                const currentQuantity = currentStockItem?.quantity || 0;
                // This logic might be complex if items are in multiple transfers.
                // For now, we base it off the log's own tracking, which is updated by sales.
                const remainingQtyInLog = item.quantity - ((log.quantitySold || 0) + (log.reversedItems?.find(ri => ri.id === item.id)?.quantity || 0));

                // Let's stick to the log's own calculation for simplicity and accuracy based on sales against THIS transfer
                const netTransferred = item.quantity - ((log.reversedItems || []).find(ri => ri.id === item.id)?.quantity || 0);
                const soldFromThisBatch = log.items.find(i => i.id === item.id)?.quantitySold || 0; // Assuming this field is added
                const netRemainingQty = netTransferred - soldFromThisBatch;


                return sum + (item.sellingPrice * Math.max(0, netRemainingQty));

            }, 0);


            return {
                ...log,
                quantitySold: totalQuantitySold,
                valueSold: totalValueSold,
                remainingQuantity: remainingQuantity,
                remainingValue: log.totalValue - totalValueSold,
            };
        });

    }, [transferLogs, stockItems, stockReturns]);

    const { totalValueSold, totalRemainingValue } = React.useMemo(() => {
        if (!processedTransferLogs) return { totalValueSold: 0, totalRemainingValue: 0 };
        let sold = 0;
        let remaining = 0;
        processedTransferLogs.forEach(log => {
            sold += log.valueSold || 0;
            remaining += log.remainingValue || 0;
        });
        return { totalValueSold: sold, totalRemainingValue: remaining };
    }, [processedTransferLogs]);

    const isLoading = areLogsLoading || areStockItemsLoading || areReturnsLoading || areSalesLoading;

    if (isLoading) {
        return <BulkAddLoading />;
    }

    return (
      <>
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <TopHeader name="Stock Transfer Report" icon={<FileText />} />
                <Button variant="outline" asChild>
                    <Link href="/stock-keeper">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Stock Keeper
                    </Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard
                    title="Total Value Sold from Transfers"
                    value={formatCurrency(totalValueSold)}
                    icon={TrendingUp}
                    description="Total cost value of items sold that came from a transfer."
                    className="border-green-500 text-green-600"
                />
                 <StatCard
                    title="Total Remaining Value"
                    value={formatCurrency(totalRemainingValue)}
                    icon={DollarSign}
                    description="Cost value of unsold items that came from transfers."
                    className="border-yellow-500 text-yellow-600"
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Transfer Breakdown</CardTitle>
                    <CardDescription>
                        A detailed report of each stock transfer and its sales performance.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <TransferReportTable
                        transferLogs={processedTransferLogs || []}
                        onViewSales={setSelectedLog}
                    />
                </CardContent>
            </Card>
        </div>
        <TransferSalesBreakdownDialog
            log={selectedLog}
            sales={salesData}
            open={!!selectedLog}
            onOpenChange={() => setSelectedLog(null)}
        />
      </>
    );
}

export default withAuth(TransferReportPage, PagePermission.VIEW_STOCK_MANAGEMENT);