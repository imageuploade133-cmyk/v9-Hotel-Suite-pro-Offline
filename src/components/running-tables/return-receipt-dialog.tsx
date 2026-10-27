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
import type { HeldSale } from '@/lib/types';
import { format, isToday, isYesterday } from 'date-fns';
import { Printer, X, Loader2, Check, Undo2, RotateCcw } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { printById } from '@/lib/print-receipt';

interface ReturnItem {
  itemId: string;
  itemName: string;
  quantity: number;
  refundAmount: number;
  originalQuantity: number;
  remainingQuantity: number;
}

interface ReturnReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  heldSale: HeldSale | null;
  returnedItems: ReturnItem[];
  totalRefundAmount: number;
  remainingAmount: number;
  originalTotal: number;
  reason?: string;
  onReprint?: () => void;
}

export function ReturnReceiptDialog({
  isOpen,
  onClose,
  heldSale,
  returnedItems,
  totalRefundAmount,
  remainingAmount,
  originalTotal,
  reason,
  onReprint
}: ReturnReceiptDialogProps) {
  const [activeTab, setActiveTab] = React.useState('terminal');
  const { settings } = useSettings();
  const { currentBranch } = useBranch();
  const [isPrinted, setIsPrinted] = React.useState(false);
  const isPrintingRef = React.useRef(false);

  const currency = settings?.currency || 'USD';

  // Use branch logo if available, otherwise fall back to settings logo
  const logoUrl = currentBranch?.logoUrl || settings?.businessLogoUrl;

  // POS-specific receipt settings for logo
  const posLogoUrl = settings?.posUseBusinessLogo !== false
    ? (logoUrl || '')
    : (settings?.posReceiptLogoUrl || logoUrl || '');
  const posLogoSize = settings?.posReceiptLogoSize || settings?.businessLogoSize || 48;
  const posShowBusinessName = settings?.posShowBusinessName !== false;
  const posShowDate = settings?.posShowDate !== false;
  const posShowCashier = settings?.posShowCashierName !== false;

  React.useEffect(() => {
    if (isOpen) {
      setIsPrinted(false);
      isPrintingRef.current = false;
    }
  }, [isOpen]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE');
  };

  const handlePrint = React.useCallback(() => {
    // Prevent multiple simultaneous prints
    if (isPrintingRef.current || isPrinted) return;

    const elementId = activeTab === 'invoice' ? 'return-receipt-invoice-print' : 'return-receipt-terminal-print';

    // Mark as printing immediately to prevent duplicate clicks
    isPrintingRef.current = true;

    printById(elementId, {
      title: 'Return Receipt'
    });

    setIsPrinted(true);
    isPrintingRef.current = false;
  }, [activeTab, isPrinted]);

  if (!heldSale) return null;

  const now = new Date();

  // Calculate total original and remaining quantities
  const totalOriginalQuantity = returnedItems.reduce((sum, item) => sum + item.originalQuantity, 0);
  const totalReturnedQuantity = returnedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalRemainingQuantity = returnedItems.reduce((sum, item) => sum + item.remainingQuantity, 0);

  const handleReprint = () => {
    setIsPrinted(false);
    isPrintingRef.current = false;
    if (onReprint) {
      onReprint();
    }
    handlePrint();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isPrintingRef.current) onClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-orange-500" />
            Return Receipt
          </DialogTitle>
          <DialogDescription>
            Return receipt for table &quot;{heldSale.name}&quot;
          </DialogDescription>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Original Total</p>
            <p className="text-lg font-bold">{formatCurrency(originalTotal)}</p>
            <p className="text-xs text-muted-foreground">{totalOriginalQuantity} items</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
            <p className="text-xs text-orange-600">Return Amount</p>
            <p className="text-lg font-bold text-orange-600">-{formatCurrency(totalRefundAmount)}</p>
            <p className="text-xs text-orange-500">{totalReturnedQuantity} items</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-xs text-green-600">Remaining</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(remainingAmount)}</p>
            <p className="text-xs text-green-500">{totalRemainingQuantity} items</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="terminal">Terminal Receipt</TabsTrigger>
            <TabsTrigger value="invoice">Professional Receipt</TabsTrigger>
          </TabsList>
          <div className="max-h-[50vh] overflow-y-auto mt-4 p-1 rounded-lg border">
            <TabsContent value="terminal">
              <div id="return-receipt-terminal-print" className="print-content p-4 bg-white text-black receipt max-w-sm mx-auto text-sm">
                <div className="text-center space-y-1 mb-4">
                  {posLogoUrl && (
                    <img
                      src={posLogoUrl}
                      alt={settings?.businessName || 'logo'}
                      style={{ height: `${posLogoSize}px`, width: 'auto' }}
                      className="object-contain mx-auto"
                    />
                  )}
                  {posShowBusinessName && (
                    <h1 className="font-bold text-lg">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                  )}
                </div>
                <div className="text-center text-xs mb-4">
                  {posShowDate && (
                    <p>Date: {now ? format(now, 'MM/dd/yyyy HH:mm:ss') : 'N/A'}</p>
                  )}
                  <p>Day: {formatDateLabel(now)}</p>
                  <p>Table: {heldSale.name}</p>
                  <p>Customer: {heldSale.customer?.name || 'Walk-in Customer'}</p>
                  {posShowCashier && <p>Processed by: {heldSale.heldByName}</p>}
                </div>
                <p className="font-bold uppercase text-center mb-2 border-y border-dashed border-black py-1">
                  RETURN RECEIPT
                </p>

                {/* Original Items Summary */}
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Original Order:</p>
                  <div className="flex justify-between text-xs">
                    <span>Total Amount:</span>
                    <span className="font-medium">{formatCurrency(originalTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Total Qty:</span>
                    <span className="font-medium">{totalOriginalQuantity}</span>
                  </div>
                </div>

                <Separator className="my-2 border-dashed border-black" />

                {/* Returned Items */}
                <p className="text-xs font-semibold uppercase text-destructive mb-1">Returned Items:</p>
                <div className="space-y-1 border-y border-dashed border-black py-2">
                  {returnedItems.map((item, index) => (
                    <div key={index}>
                      <div className="flex justify-between text-destructive">
                        <span className="line-through">{item.itemName}</span>
                        <span>-{formatCurrency(item.refundAmount)}</span>
                      </div>
                      <div className="text-xs ml-2 text-muted-foreground">
                        Return: {item.quantity} of {item.originalQuantity}
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-2" />

                {/* Totals Section */}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Original Total:</span>
                    <span className="font-medium">{formatCurrency(originalTotal)}</span>
                  </div>
                  <div className="flex justify-between text-destructive">
                    <span>Return Amount:</span>
                    <span>-{formatCurrency(totalRefundAmount)}</span>
                  </div>
                </div>

                <Separator className="my-2 border-black" />

                {/* Remaining Section */}
                <div className="flex justify-between font-bold text-base pt-1">
                  <span>REMAINING:</span>
                  <span>{formatCurrency(remainingAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Items Remaining:</span>
                  <span>{totalRemainingQuantity}</span>
                </div>

                {reason && (
                  <div className="text-xs mt-3 p-2 bg-muted rounded">
                    <p className="font-semibold">Reason:</p>
                    <p>{reason}</p>
                  </div>
                )}

                <div className="text-center text-xs mt-4 pt-2 border-t border-dashed border-black">
                  {(!posShowCashier) && <p>Processed by: {heldSale.heldByName}</p>}
                  <p className="mt-1">Thank you for your business!</p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="invoice">
              <div id="return-receipt-invoice-print" className="print-content p-8 bg-white text-black text-sm">
                {/* Header with Logo */}
                <div className="text-center mb-4">
                  {posLogoUrl && (
                    <img
                      src={posLogoUrl}
                      alt={settings?.businessName || 'logo'}
                      style={{ height: `${posLogoSize * 1.5}px`, width: 'auto' }}
                      className="object-contain mx-auto mb-2"
                    />
                  )}
                  {posShowBusinessName && (
                    <h2 className="font-bold text-xl mt-2">{settings?.businessName || 'Hotel Suite Pro'}</h2>
                  )}
                </div>

                <h2 className="font-bold text-xl text-center mb-4 text-orange-600">RETURN RECEIPT</h2>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <p><strong>Table Name:</strong> {heldSale.name}</p>
                    <p><strong>Customer:</strong> {heldSale.customer?.name || 'Walk-in Customer'}</p>
                  </div>
                  <div className="text-right">
                    <p><strong>Date:</strong> {now ? format(now, 'PPpp') : 'N/A'}</p>
                    <p><strong>Day:</strong> {formatDateLabel(now)}</p>
                  </div>
                </div>

                <hr className="my-4"/>

                {/* Original Order Summary */}
                <div className="mb-4">
                  <p className="font-semibold mb-2 text-muted-foreground">Original Order Summary:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm bg-muted p-3 rounded">
                    <div>
                      <span className="text-muted-foreground">Original Total:</span>
                      <span className="font-bold ml-2">{formatCurrency(originalTotal)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Original Qty:</span>
                      <span className="font-bold ml-2">{totalOriginalQuantity}</span>
                    </div>
                  </div>
                </div>

                <p className="font-semibold mb-2 text-destructive">Returned Items:</p>
                <table className="w-full mb-4">
                  <thead className="bg-red-50">
                    <tr className="text-left text-sm">
                      <th className="p-2">Item</th>
                      <th className="p-2 text-center">Returned</th>
                      <th className="p-2 text-center">Original Qty</th>
                      <th className="p-2 text-right">Refund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnedItems.map((item, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2 text-destructive line-through">{item.itemName}</td>
                        <td className="p-2 text-center">{item.quantity}</td>
                        <td className="p-2 text-center text-muted-foreground">{item.originalQuantity}</td>
                        <td className="p-2 text-right text-destructive">-{formatCurrency(item.refundAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <hr className="my-4"/>

                {/* Totals */}
                <div className="space-y-2 max-w-xs ml-auto">
                  <div className="flex justify-between text-sm">
                    <span>Original Total:</span>
                    <span>{formatCurrency(originalTotal)}</span>
                  </div>
                  <div className="flex justify-between text-destructive text-sm">
                    <span>Return Amount:</span>
                    <span>-{formatCurrency(totalRefundAmount)}</span>
                  </div>
                  <hr/>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Remaining:</span>
                    <span className="text-green-600">{formatCurrency(remainingAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Items Remaining:</span>
                    <span>{totalRemainingQuantity}</span>
                  </div>
                </div>

                {reason && (
                  <div className="mt-4 p-3 bg-muted rounded">
                    <p className="font-semibold text-sm">Reason:</p>
                    <p className="text-sm">{reason}</p>
                  </div>
                )}

                <div className="mt-6 text-center text-muted-foreground text-sm">
                  <p>Processed by: {heldSale.heldByName}</p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
        <DialogFooter className="sm:justify-between flex-row pt-4 gap-2">
          <Button variant="ghost" onClick={onClose}>
            <X className="mr-2 h-4 w-4" /> {isPrinted ? 'Close' : 'Cancel'}
          </Button>
          <div className="flex gap-2">
            {isPrinted && onReprint && (
              <Button variant="outline" onClick={handleReprint}>
                <RotateCcw className="mr-2 h-4 w-4" /> Re-print
              </Button>
            )}
            <Button onClick={handlePrint} disabled={isPrintingRef.current || isPrinted}>
              {isPrintingRef.current ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
              ) : isPrinted ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              {isPrintingRef.current ? 'Printing...' : (isPrinted ? 'Printed' : 'Print Return Receipt')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
