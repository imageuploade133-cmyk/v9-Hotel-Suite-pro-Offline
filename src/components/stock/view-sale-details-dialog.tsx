
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
import { Separator } from '@/components/ui/separator';
import type { StockSale } from '@/lib/types';
import { format } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { X } from 'lucide-react';

interface ViewSaleDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sale: StockSale | null;
  currency: string;
}

export function ViewSaleDetailsDialog({ isOpen, onClose, sale, currency }: ViewSaleDetailsDialogProps) {
  if (!sale) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const soldAtDate = getSafeDate(sale.soldAt);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sale Details: #{sale.saleId}</DialogTitle>
          <DialogDescription>
            Detailed view of the transaction.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
            <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Date</p>
                        <p className="font-semibold">{soldAtDate ? format(soldAtDate, 'PPpp') : 'N/A'}</p>
                    </div>
                     <div>
                        <p className="text-muted-foreground">Processed By</p>
                        <p className="font-semibold">{sale.soldByName}</p>
                    </div>
                     <div>
                        <p className="text-muted-foreground">Customer</p>
                        <p className="font-semibold">{sale.customerName || 'Walk-in'}</p>
                    </div>
                     <div>
                        <p className="text-muted-foreground">Payment</p>
                        <div className="font-semibold flex items-center gap-2">
                          {sale.paymentMethod} - <Badge variant={sale.paymentStatus === 'Paid' ? 'success' : 'warning'}>{sale.paymentStatus}</Badge>
                        </div>
                    </div>
                </div>
                <Separator />
                <h4 className="font-semibold">Items Sold</h4>
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {sale.items.map((item, index) => (
                        <TableRow key={`${item.itemId}-${index}`}>
                        <TableCell>{item.itemName}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.sellingPrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.sellingPrice * item.quantity)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="font-bold text-base">
                            <TableCell colSpan={3} className="text-right">Total</TableCell>
                            <TableCell className="text-right">{formatCurrency(sale.totalAmount)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" /> Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
