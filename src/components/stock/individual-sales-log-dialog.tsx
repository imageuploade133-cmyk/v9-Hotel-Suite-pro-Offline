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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { EmptyState } from '../ui/empty-state';
import { History } from 'lucide-react';
import type { ProductPerformanceData } from '@/app/(protected)/product-sales/page';

interface IndividualSalesLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductPerformanceData | null;
  currency: string;
}

export function IndividualSalesLogDialog({ open, onOpenChange, product, currency }: IndividualSalesLogDialogProps) {
  if (!product) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  const flattenedSales = React.useMemo(() => {
    return product.sales.map(sale => ({
        ...sale,
        totalValue: sale.sellingPrice * sale.quantity,
    }));
  }, [product.sales]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Sales Log: {product.name}</DialogTitle>
          <DialogDescription>
            A complete history of every time this product was sold in the selected period.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
          <div className="py-4">
            {flattenedSales.length === 0 ? (
                <EmptyState
                    icon={History}
                    title="No Sales"
                    description="This product has no sales recorded for the selected period."
                />
            ) : (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Sold By</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {flattenedSales.map((sale, index) => (
                    <TableRow key={`${sale.id}-${index}`}>
                        <TableCell>{format(getSafeDate(sale.soldAt)!, 'PPp')}</TableCell>
                        <TableCell>{sale.customerName || 'Walk-in'}</TableCell>
                        <TableCell>{sale.soldByName}</TableCell>
                        <TableCell className="text-center">{sale.quantity}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(sale.totalValue)}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
