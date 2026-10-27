'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { StockSale, TransferLog } from '@/lib/types';
import { DataTable } from '../ui/data-table';
import { getSalesLogColumns } from '../stock/sales-log-columns';
import { useSettings } from '@/contexts/settings-context';
import { EmptyState } from '../ui/empty-state';
import { History } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

interface TransferSalesBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: TransferLog | null;
  sales: StockSale[] | null;
}

export function TransferSalesBreakdownDialog({
  open,
  onOpenChange,
  log,
  sales,
}: TransferSalesBreakdownDialogProps) {
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const columns = React.useMemo(() => getSalesLogColumns(currency), [currency]);

  const relevantSales = React.useMemo(() => {
    if (!log || !sales) return [];

    const transferItemIds = new Set(log.items.map(item => item.id));

    return sales
      .map(sale => {
        const itemsInSaleFromThisTransfer = sale.items.filter(saleItem => transferItemIds.has(saleItem.itemId));
        if (itemsInSaleFromThisTransfer.length > 0) {
          return { ...sale, items: itemsInSaleFromThisTransfer };
        }
        return null;
      })
      .filter(Boolean) as StockSale[];
  }, [log, sales]);

  const flattenedSales = React.useMemo(() => {
    if (!relevantSales) return [];
    return relevantSales.flatMap(sale =>
        sale.items.map(item => ({
            ...sale,
            quantity: item.quantity,
            sellingPrice: item.sellingPrice,
            total: item.sellingPrice * item.quantity,
            itemName: item.itemName // Add item name for display
        }))
    );
  }, [relevantSales]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Sales Breakdown for Transfer</DialogTitle>
          <DialogDescription>
            Showing all sales that include items from transfer ID: <span className="font-mono">{log?.id.substring(0,8)}...</span>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="max-h-[60vh] overflow-y-auto border rounded-md">
            {false ? (
                <Skeleton className="h-64 w-full" />
            ) : flattenedSales.length === 0 ? (
                <div className="p-6">
                    <EmptyState
                        icon={History}
                        title="No Sales Recorded"
                        description="No sales have been recorded for items from this transfer batch yet."
                    />
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={flattenedSales}
                    tableId={`sales-log-transfer-${log?.id}`}
                    filterColumn="itemName"
                    filterPlaceholder="Filter by item name..."
                />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
