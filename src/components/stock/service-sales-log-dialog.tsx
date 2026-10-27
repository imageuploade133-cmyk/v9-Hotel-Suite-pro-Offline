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
import type { StockSale } from '@/lib/types';
import type { UnifiedItem } from './service-management';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { useSettings } from '@/contexts/settings-context';
import { EmptyState } from '../ui/empty-state';
import { History } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

interface ServiceSalesLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: UnifiedItem | null;
}

export function ServiceSalesLogDialog({ open, onOpenChange, item }: ServiceSalesLogDialogProps) {
  const firestore = useFirestore();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';

  const salesQuery = React.useMemo(() => {
    if (!firestore || !item) return null;
    // Firestore doesn't support querying array fields for a specific value in a sub-property directly.
    // We fetch all sales and filter client-side. This is not ideal for large datasets.
    return query(collection(firestore, 'stockSales'), orderBy('soldAt', 'desc'));
  }, [firestore, item]);

  const { data: allSales, isLoading } = useCollection<StockSale>(salesQuery);

  const relevantSales = React.useMemo(() => {
    if (!allSales || !item) return [];
    return allSales.filter(sale => sale.items.some(saleItem => saleItem.name === item.name || saleItem.itemName === item.name));
  }, [allSales, item]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sales Log: {item?.name}</DialogTitle>
          <DialogDescription>
            Showing all past sales for this service or food item.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
            <div className="py-4">
                {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : relevantSales.length === 0 ? (
                    <EmptyState
                        icon={History}
                        title="No Sales History"
                        description="This item has not been sold yet."
                    />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead className="text-center">Qty</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {relevantSales.map(sale => {
                                const saleItem = sale.items.find(i => i.name === item?.name || i.itemName === item?.name);
                                if (!saleItem) return null;
                                return (
                                    <TableRow key={sale.id}>
                                        <TableCell>{format(getSafeDate(sale.soldAt)!, 'PPp')}</TableCell>
                                        <TableCell>{sale.customerName || 'Walk-in'}</TableCell>
                                        <TableCell className="text-center">{saleItem.quantity}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(saleItem.sellingPrice * saleItem.quantity)}</TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
