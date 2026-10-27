
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
import {
  AlertDialog,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { Booking, Bill, Payment, StockReturn, BillItem } from '@/lib/types';
import { GuestFolio } from './guest-folio';
import { X, ChevronLeft, Undo2, Minus, Plus, Trash2, Printer, Copy, Share } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, writeBatch, runTransaction, increment, serverTimestamp, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/user-context';
import { usePermissions } from '@/hooks/use-permissions';
import { PagePermission } from '@/lib/permissions';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useSettings } from '@/contexts/settings-context';
import { formatCurrency } from '@/lib/helpers';
import Image from 'next/image';
import { useBranch } from '@/contexts/branch-context';

interface GuestBillDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  allBills: Bill[] | null;
  allPayments: Payment[] | null;
  isLoading: boolean;
  onViewImage: (url: string) => void;
  onBillPrinted?: () => void;
}

export function GuestBillDialog({
  isOpen,
  onClose,
  booking,
  allBills,
  allPayments,
  isLoading,
  onViewImage,
  onBillPrinted
}: GuestBillDialogProps) {
  const [itemToReturn, setItemToReturn] = React.useState<{ bill: Bill; item: BillItem } | null>(null);
  const [isReturning, setIsReturning] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile } = useUser();
  const { hasPermission } = usePermissions();
  const { getCollectionPath } = useBranch();
  const [allReturns, setAllReturns] = React.useState<StockReturn[]>([]);

  const [returnQuantity, setReturnQuantity] = React.useState(1);
  const [returnReason, setReturnReason] = React.useState('');
  const { settings } = useSettings();
  const [isPrinting, setIsPrinting] = React.useState(false);
  const currency = settings?.currency || 'USD';
  const [guestBillUrl, setGuestBillUrl] = React.useState('');
  const [billsPrinted, setBillsPrinted] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && booking?.roomNumber && typeof window !== 'undefined') {
      setGuestBillUrl(`${window.location.origin}/guest-bill?room=${booking.roomNumber}`);
    }
    // Reset printed state when dialog opens
    setBillsPrinted(false);
  }, [isOpen, booking]);

  const handleCopyUrl = () => {
    if (!guestBillUrl) return;
    navigator.clipboard.writeText(guestBillUrl);
    toast({
      title: 'URL Copied',
      description: 'The guest bill URL has been copied to your clipboard.',
    });
  };

  const handleShare = async () => {
    if (navigator.share && guestBillUrl) {
      try {
        await navigator.share({
          title: 'Guest Bill',
          text: `View the bill for ${booking?.guestName}`,
          url: guestBillUrl,
        });
      } catch (error) {
        console.error('Error sharing:', error);
        handleCopyUrl();
      }
    } else {
      handleCopyUrl();
    }
  };

  const handleReturnItem = (bill: Bill, item: BillItem) => {
    // Check for refund permission before allowing return
    const hasRolesPermission = hasPermission(PagePermission.MANAGE_ROLES);
    if (!hasPermission(PagePermission.PROCESS_SALE_REFUNDS) && !hasRolesPermission) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'You do not have permission to return items from bills. Please contact your administrator.',
      });
      return;
    }

    setItemToReturn({ bill, item });
    setReturnQuantity(1);
    setReturnReason('');
  };

  React.useEffect(() => {
    if (isPrinting) {
      // Mark bills as printed before printing
      markBillAsPrinted();

      // Wait for React to render, then for browser to paint, then for images to load
      const waitForRender = () => {
        // Double RAF ensures both React render and browser paint cycles complete
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Check if any images are still loading
            const images = document.querySelectorAll('.printable-area img');
            const loadingImages = Array.from(images).filter((img) => !(img as HTMLImageElement).complete);

            if (loadingImages.length === 0) {
              // All images loaded, safe to print
              window.print();
              setIsPrinting(false);
            } else {
              // Wait for images to load
              let loadedCount = 0;
              const onImageLoad = () => {
                loadedCount++;
                if (loadedCount >= loadingImages.length) {
                  window.print();
                  setIsPrinting(false);
                }
              };

              loadingImages.forEach((img) => {
                if ((img as HTMLImageElement).complete) {
                  onImageLoad();
                } else {
                  img.addEventListener('load', onImageLoad, { once: true });
                  img.addEventListener('error', onImageLoad, { once: true });
                }
              });

              // Fallback: print anyway after 2 seconds even if images haven't loaded
              setTimeout(() => {
                setIsPrinting(false);
                window.print();
              }, 2000);
            }
          });
        });
      };

      waitForRender();
    }
  }, [isPrinting]);

  // Check if an item has been printed (fully or partially)
  const getPrintedQuantity = (item: BillItem): number => {
    return item.printedQuantity || 0;
  };

  // Check if an item is fully printed (all quantity printed)
  const isItemFullyPrinted = (item: BillItem): boolean => {
    const printedQty = getPrintedQuantity(item);
    return printedQty >= item.quantity;
  };

  // Get the returnable quantity (total - printed)
  const getReturnableQuantity = (item: BillItem): number => {
    const printedQty = getPrintedQuantity(item);
    return Math.max(0, item.quantity - printedQty);
  };

  const handleConfirmReturn = async () => {
    // Robust permission check at confirmation time
    const hasRolesPermission = hasPermission(PagePermission.MANAGE_ROLES);
    if (!hasPermission(PagePermission.PROCESS_SALE_REFUNDS) && !hasRolesPermission) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'You do not have permission to process returns. This action has been blocked.',
      });
      setItemToReturn(null);
      return;
    }

    if (!firestore || !userProfile || !itemToReturn) {
      toast({ variant: 'destructive', title: 'Error', description: 'Authentication context is not available.' });
      return;
    }
    const { bill, item } = itemToReturn;
    const quantity = returnQuantity;
    const reason = returnReason;

    // Validate that we're not returning printed items
    const returnableQty = getReturnableQuantity(item);
    if (quantity > returnableQty) {
      toast({
        variant: 'destructive',
        title: 'Cannot Return Printed Items',
        description: `Only ${returnableQty} item(s) can be returned. ${getPrintedQuantity(item)} item(s) have already been printed.`
      });
      return;
    }

    // Check if bill is fully printed
    if (bill.printStatus === 'printed') {
      toast({
        variant: 'destructive',
        title: 'Cannot Return',
        description: 'This bill has been printed and cannot be modified.'
      });
      return;
    }

    setIsReturning(true);

    try {
      await runTransaction(firestore, async (transaction) => {
        const billRef = doc(firestore, `bookings/${(bill as any).bookingId}/bills`, bill.id);
        const billDoc = await transaction.get(billRef);

        if (!billDoc.exists()) {
          throw new Error("Bill document not found.");
        }

        const billData = billDoc.data() as Bill;
        const itemIndex = billData.items.findIndex(i => i.id === item.id);

        if (itemIndex === -1) {
          throw new Error("Item not found in the bill.");
        }

        // Double-check printed status in transaction
        const currentItem = billData.items[itemIndex];
        const currentPrintedQty = currentItem.printedQuantity || 0;
        const currentReturnableQty = Math.max(0, currentItem.quantity - currentPrintedQty);

        if (quantity > currentReturnableQty) {
          throw new Error(`Cannot return ${quantity} item(s). Only ${currentReturnableQty} item(s) can be returned (${currentPrintedQty} have been printed).`);
        }

        if (billData.printStatus === 'printed') {
          throw new Error("This bill has been printed and cannot be modified.");
        }

        // If it's a stock item (not a service), return to stock
        if (!item.isService) {
          const stockItemRef = doc(firestore, getCollectionPath('stock'), item.id);
          const stockDoc = await transaction.get(stockItemRef);
          if (!stockDoc.exists()) {
            throw new Error("Stock item not found. Cannot return to stock.");
          }
          transaction.update(stockItemRef, { quantity: increment(quantity) });
        }

        // Create return record for audit trail
        const returnRef = doc(collection(firestore, getCollectionPath('stockReturns')));
        transaction.set(returnRef, {
            originalSaleId: bill.id,
            items: [{ itemId: item.id, itemName: item.name, quantity, refundAmount: item.price }],
            totalRefundAmount: item.price * quantity,
            reason: reason || 'Returned from guest bill',
            returnedAt: serverTimestamp(),
            returnedByUid: userProfile.uid,
            returnedByName: userProfile.name,
            refundId: returnRef.id,
            bookingId: (bill as any).bookingId,
            customerName: booking?.guestName,
        });


        const newItems = [...billData.items];
        newItems[itemIndex].quantity -= quantity;
        const newTotal = billData.total - (item.price * quantity);

        transaction.update(billRef, {
            items: newItems.filter(i => i.quantity > 0),
            total: newTotal
        });
      });

      toast({ variant: 'success', title: 'Item Returned', description: `${quantity} x ${item.name} has been returned.` });
      setItemToReturn(null);

    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Return Failed', description: e.message });
    } finally {
      setIsReturning(false);
    }
  };

  // Mark bill and items as printed when printing
  const markBillAsPrinted = async () => {
    if (!firestore || !userProfile || !booking || !allBills) return;

    // Immediately mark bills as printed locally to disable refund button
    setBillsPrinted(true);

    try {
      const batch = writeBatch(firestore);
      const now = new Date();

      allBills.forEach(bill => {
        const billRef = doc(firestore, `bookings/${booking.id}/bills`, bill.id);

        // Update each item's printed quantity to match current quantity
        const updatedItems = bill.items.map(item => ({
          ...item,
          printedQuantity: item.quantity
        }));

        batch.update(billRef, {
          items: updatedItems,
          printStatus: 'printed',
          printedAt: serverTimestamp(),
          printedBy: userProfile.uid,
          printedByName: userProfile.name,
        });
      });

      await batch.commit();
      // Call callback to refresh bills data
      onBillPrinted?.();
    } catch (error) {
      console.error('Error marking bill as printed:', error);
      // Don't block printing if marking fails
      // Note: billsPrinted state remains true even if Firestore update fails
    }
  };

  const handleQuantityChange = (newQuantity: number) => {
    if (itemToReturn && newQuantity > 0 && newQuantity <= itemToReturn.item.quantity) {
      setReturnQuantity(newQuantity);
    }
  }

  const renderReturnUI = () => {
    if (!itemToReturn) return null;
    const { bill, item } = itemToReturn;
    const printedQty = getPrintedQuantity(item);
    const returnableQty = getReturnableQuantity(item);
    const isFullyPrinted = isItemFullyPrinted(item);
    const isBillPrinted = bill.printStatus === 'printed';

    return (
      <>
        <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>Return Item from Bill?</DialogTitle>
            <DialogDescription>
                You are about to return <span className="font-bold">"{item.name}"</span>.
                This will credit the guest's bill and add the item back to stock if applicable.
            </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-4">
            {(isFullyPrinted || isBillPrinted) && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                <Printer className="h-4 w-4 shrink-0" />
                <p className="text-sm font-medium">
                  {isBillPrinted
                    ? 'This bill has been printed and cannot be modified.'
                    : `${printedQty} item(s) have been printed and cannot be returned.`}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Currently on bill: {item.quantity}
                      {printedQty > 0 && (
                        <span className="text-amber-600 ml-2">({printedQty} printed)</span>
                      )}
                    </p>
                    {returnableQty < item.quantity && returnableQty > 0 && (
                      <p className="text-sm text-green-600 mt-1">
                        Max returnable: {returnableQty}
                      </p>
                    )}
                </div>
                 <p className="font-semibold">{formatCurrency(item.price, currency)} each</p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="return-quantity">Quantity to Return</Label>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => handleQuantityChange(returnQuantity - 1)}
                        disabled={returnQuantity <= 1 || isFullyPrinted || isBillPrinted}
                    >
                        <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                        id="return-quantity"
                        type="number"
                        value={returnQuantity}
                        onChange={(e) => handleQuantityChange(parseInt(e.target.value))}
                        className="w-20 text-center"
                        max={returnableQty}
                        min={1}
                        disabled={isFullyPrinted || isBillPrinted}
                    />
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => handleQuantityChange(returnQuantity + 1)}
                        disabled={returnQuantity >= returnableQty || isFullyPrinted || isBillPrinted}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="return-reason">Reason for Return (Optional)</Label>
                <Textarea
                    id="return-reason"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="e.g., Guest changed their mind, item was faulty."
                    disabled={isFullyPrinted || isBillPrinted}
                />
            </div>
            <p className="text-sm font-semibold text-destructive text-center">
                This will credit the bill by {formatCurrency(item.price * returnQuantity, currency)}.
            </p>
        </div>
        <DialogFooter className="p-6 pt-4 border-t">
          <Button variant="ghost" onClick={() => setItemToReturn(null)} disabled={isReturning}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleConfirmReturn}
            loading={isReturning}
            disabled={isFullyPrinted || isBillPrinted || returnableQty === 0}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Return {returnQuantity} Item(s)
          </Button>
        </DialogFooter>
      </>
    )
  };

  if (!booking && !isLoading) {
    return null;
  }

  const printStyles = `
    @media print { @page { margin: 0mm !important; }
      .no-print {
        display: none !important;
      }
      .printable-area {
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
      }
    }
  `;

  return (
    <>
      <style>{printStyles}</style>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full max-w-4xl h-full max-h-full flex flex-col sm:max-h-[90vh] sm:h-auto p-0 printable-area">
          {itemToReturn ? renderReturnUI() : (
            isLoading ? (
                <div className="flex-1 p-6 space-y-4 overflow-hidden">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-32 w-full" />
                </div>
            ) : booking ? (
                <>
                <DialogHeader className="p-6 pb-0 no-print">
                    <DialogTitle>Guest Folio</DialogTitle>
                    <DialogDescription>
                    A detailed breakdown of all charges and payments for {booking.guestName} in Room {booking.roomNumber}.
                    </DialogDescription>
                </DialogHeader>

                <GuestFolio
                    booking={booking}
                    allBills={allBills}
                    allPayments={allPayments}
                    allReturns={allReturns}
                    onReturnItem={handleReturnItem}
                    onBack={onClose}
                    onViewImage={onViewImage}
                    billsPrinted={billsPrinted}
                />
                <DialogFooter className="p-4 border-t bg-background no-print flex-col sm:flex-row gap-2">
                  <div className="flex-1 relative">
                    <Input
                      readOnly
                      value={guestBillUrl}
                      className="pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={handleCopyUrl}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={handleShare} className="w-full sm:w-auto">
                      <Share className="mr-2 h-4 w-4" />
                      Share
                    </Button>
                    <Button variant="default" onClick={() => setIsPrinting(true)} className="w-full sm:w-auto">
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                    <Button onClick={onClose} variant="outline" className="flex items-center gap-2 w-full sm:w-auto">
                      <X className="w-4 h-4" />
                      Close
                    </Button>
                  </div>
                </DialogFooter>
                </>
            ) : null
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
