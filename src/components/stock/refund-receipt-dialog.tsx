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
import { Separator } from '../ui/separator';
import type { StockReturn, StockSale } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { getSafeDate } from '@/lib/helpers';
import { printHtml } from '@/lib/print-receipt';

interface RefundReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  refund: StockReturn | null;
  sale: StockSale | null;
}

export function RefundReceiptDialog({ isOpen, onClose, refund, sale }: RefundReceiptDialogProps) {
  const receiptRef = React.useRef<HTMLDivElement>(null);
  const { settings, getEffectivePosSettings } = useSettings();
  const { currentBranch, isGlobalMode } = useBranch();

  // Get effective POS settings based on current context (Global vs Branch)
  const effectivePosSettings = getEffectivePosSettings();

  const currency = settings?.currency || 'USD';

  // Use effective POS settings for logo and business info
  const posLogoUrl = effectivePosSettings.posUseBusinessLogo !== false
    ? (effectivePosSettings.posReceiptLogoUrl || settings?.businessLogoUrl || '')
    : (effectivePosSettings.posReceiptLogoUrl || settings?.businessLogoUrl || '');
  const posLogoSize = effectivePosSettings.posReceiptLogoSize || settings?.businessLogoSize || 48;

  // Business name and address - use effective POS settings
  const effectiveBusinessName = effectivePosSettings.businessName;
  const displayName = effectiveBusinessName || (isGlobalMode ? (settings?.businessName || 'Hotel Suite Pro') : (currentBranch?.name || settings?.businessName || 'Hotel Suite Pro'));
  const displayAddress = effectivePosSettings.businessAddress !== undefined
    ? effectivePosSettings.businessAddress
    : (isGlobalMode ? settings?.businessAddress : (currentBranch?.address || settings?.businessAddress));

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;
    const useIframe = !!effectivePosSettings.posAllowPopups;
    printHtml(printContent.innerHTML, { title: `Refund Receipt #${refund?.refundId || ''}`, useIframe });
  };

  if (!refund) return null;

  const returnedAtDate = getSafeDate(refund.returnedAt);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Refund Receipt #{refund.refundId}</DialogTitle>
          <DialogDescription>A receipt for the refund transaction.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
          <div ref={receiptRef} className="p-4 bg-white text-black receipt text-sm">
            <div className="text-center space-y-1 mb-4">
              {posLogoUrl && (
                <img
                  src={posLogoUrl}
                  alt={displayName || 'logo'}
                  style={{ height: `${posLogoSize}px` }}
                  className="mx-auto"
                />
              )}
              <h1 className="font-bold text-lg">{displayName}</h1>
              {displayAddress && <p className="text-xs">{displayAddress}</p>}
              <p className="font-bold uppercase">Refund Receipt</p>
            </div>

            <Separator className="my-2 border-dashed border-black" />

            <div className="text-xs mb-2 space-y-0.5">
              <div className="flex justify-between">
                <span>Refund ID:</span>
                <span className="font-bold">#{refund.refundId}</span>
              </div>
              <div className="flex justify-between">
                <span>Original Sale ID:</span>
                <span className="font-bold">#{refund.originalSaleId}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{returnedAtDate ? format(returnedAtDate, 'MM/dd/yyyy HH:mm') : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span className="font-bold">{refund.returnedByName}</span>
              </div>
              {refund.customerName && (
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold">{refund.customerName}</span>
                </div>
              )}
            </div>

            <Separator className="my-2 border-dashed border-black" />

            <div className="my-2">
              <p className="font-bold text-xs uppercase mb-1">Items Returned</p>
              {refund.items.map((item, index) => (
                <div key={`${item.itemId}-${index}`} className="grid grid-cols-[1fr_auto_auto] gap-x-2 text-xs">
                  <span className="truncate">{item.itemName}</span>
                  <span className="text-center font-semibold">x{item.quantity}</span>
                  <span className="text-right">{formatCurrency(item.refundAmount * item.quantity)}</span>
                </div>
              ))}
            </div>

            <Separator className="my-2 border-dashed border-black" />

            <div className="text-right font-bold text-lg text-destructive">
              TOTAL REFUNDED: {formatCurrency(refund.totalRefundAmount)}
            </div>
            <div className="text-center text-xs mt-6">
              <p>Items have been returned to stock.</p>
              <p>This is a computer-generated document.</p>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between flex-row pt-4">
          <Button variant="ghost" onClick={onClose}>
            <X className="mr-2 h-4 w-4" /> Close
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
