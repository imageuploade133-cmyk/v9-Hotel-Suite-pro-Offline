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
import type { StockReturn } from '@/lib/types';
import { format } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { X, FileText } from 'lucide-react';

interface ViewRefundDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  refund: StockReturn | null;
  currency: string;
  onViewOriginalSale: (saleId: string) => void;
}

export function ViewRefundDetailsDialog({ isOpen, onClose, refund, currency, onViewOriginalSale }: ViewRefundDetailsDialogProps) {
  if (!refund) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const returnedAtDate = getSafeDate(refund.returnedAt);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Refund Details: #{refund.refundId}</DialogTitle>
          <DialogDescription>
            Detailed view of the refund transaction.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
            <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Date</p>
                        <p className="font-semibold">{returnedAtDate ? format(returnedAtDate, 'PPpp') : 'N/A'}</p>
                    </div>
                     <div>
                        <p className="text-muted-foreground">Processed By</p>
                        <p className="font-semibold">{refund.processedByName}</p>
                    </div>
                     <div>
                        <p className="text-muted-foreground">Customer</p>
                        <p className="font-semibold">{refund.customerName || 'N/A'}</p>
                    </div>
                     <div>
                        <p className="text-muted-foreground">Reason</p>
                        <p className="font-semibold italic">"{refund.reason || 'Not specified'}"</p>
                    </div>
                </div>
                <Separator />
                <h4 className="font-semibold">Items Returned</h4>
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {refund.items.map((item, index) => (
                        <TableRow key={`${item.itemId}-${index}`}>
                        <TableCell>{item.itemName}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.refundAmount * item.quantity)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="font-bold text-base text-destructive">
                            <TableCell colSpan={2} className="text-right">Total Refunded</TableCell>
                            <TableCell className="text-right">{formatCurrency(refund.totalRefundAmount)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
        </ScrollArea>
        <DialogFooter className="justify-between">
            <Button variant="outline" onClick={() => onViewOriginalSale(refund.originalSaleId)}>
                <FileText className="mr-2 h-4 w-4" /> View Original Sale
            </Button>
            <Button onClick={onClose}>
                <X className="mr-2 h-4 w-4" /> Close
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
