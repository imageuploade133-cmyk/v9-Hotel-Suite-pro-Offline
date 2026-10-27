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
import { Button } from '../ui/button';
import type { HeldSale } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, Check, AlertCircle } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { getSafeDate } from '@/lib/helpers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Logo } from '../logo';
import { printHtml } from '@/lib/print-receipt';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/branch-context';

interface UnprintedItemsReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  heldSale: HeldSale | null;
  onPrinted?: () => void;
}

export function UnprintedItemsReceiptDialog({ isOpen, onClose, heldSale, onPrinted }: UnprintedItemsReceiptDialogProps) {
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState('terminal');
  const { settings, getEffectivePosSettings } = useSettings();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { getCollectionPath, currentBranch, isGlobalMode } = useBranch();
  const [isPrinted, setIsPrinted] = React.useState(false);
  const isPrintingRef = React.useRef(false);
  const prevHeldSaleRef = React.useRef<HeldSale | null>(null);

  // Real-time state for the held sale
  const [liveHeldSale, setLiveHeldSale] = React.useState<HeldSale | null>(null);
  const [wasClosedByAnotherDevice, setWasClosedByAnotherDevice] = React.useState(false);
  const [documentFound, setDocumentFound] = React.useState(false);

  const currency = settings?.currency || 'USD';

  // Get effective POS settings based on current context (Global vs Branch)
  const effectivePosSettings = getEffectivePosSettings();

  // Use branch-specific information if available, otherwise fall back to global settings
  const branchLogoUrl = currentBranch?.logoUrl;
  const branchName = currentBranch?.name;
  const branchAddress = currentBranch?.address;
  const branchPhone = currentBranch?.phoneNumber;

  // Use effective POS settings with proper separation between Global and Branch
  const posLogoUrl = effectivePosSettings.posUseBusinessLogo !== false
    ? (effectivePosSettings.posReceiptLogoUrl || branchLogoUrl || settings?.businessLogoUrl || '')
    : (effectivePosSettings.posReceiptLogoUrl || settings?.businessLogoUrl || '');
  const posLogoSize = effectivePosSettings.posReceiptLogoSize || settings?.businessLogoSize || 48;
  const posShowBusinessName = effectivePosSettings.posShowBusinessName !== false;
  const posShowDate = effectivePosSettings.posShowDate !== false;
  const posShowCashier = effectivePosSettings.posShowCashierName !== false;

  // Display name - use effective POS settings business name
  const effectiveBusinessName = effectivePosSettings.businessName;
  const displayName = effectiveBusinessName || (isGlobalMode ? (settings?.businessName || 'Hotel Suite Pro') : (branchName || settings?.businessName || 'Hotel Suite Pro'));

  // Display address and phone - use effective POS settings (separate for each context)
  const displayAddress = effectivePosSettings.businessAddress !== undefined
    ? effectivePosSettings.businessAddress
    : (isGlobalMode ? settings?.businessAddress : (branchAddress || settings?.businessAddress));
  const displayPhone = effectivePosSettings.businessPhone !== undefined
    ? effectivePosSettings.businessPhone
    : (isGlobalMode ? settings?.businessPhone : (branchPhone || settings?.businessPhone));

  // Set up real-time listener for the held sale document
  React.useEffect(() => {
    if (!isOpen || !heldSale || !firestore) {
      setLiveHeldSale(null);
      setWasClosedByAnotherDevice(false);
      setDocumentFound(false);
      return;
    }

    // Reset state when dialog opens
    setIsPrinted(false);
    isPrintingRef.current = false;
    setWasClosedByAnotherDevice(false);
    setDocumentFound(false);

    // Set up a timeout to mark document as found if listener doesn't respond in time
    // This prevents false "Table Closed" messages while waiting for Firestore to respond
    let docFoundTimeout: NodeJS.Timeout;
    const setDocFoundTimeout = () => {
      docFoundTimeout = setTimeout(() => {
        setDocumentFound(true);
      }, 2000);
    };

    setDocFoundTimeout();

    // Subscribe to real-time updates for this specific held sale using the correct collection path
    const saleRef = doc(firestore, getCollectionPath('heldSales'), heldSale.id);
    const unsubscribe = onSnapshot(
      saleRef,
      (docSnapshot) => {
        clearTimeout(docFoundTimeout);
        if (docSnapshot.exists()) {
          const data = { id: docSnapshot.id, ...docSnapshot.data() } as HeldSale;
          setLiveHeldSale(data);
          setDocumentFound(true);
        } else {
          // Only trigger "closed by another device" if we already found the document before
          // This prevents false positives on initial load when the document path is resolving
          if (documentFound) {
            setWasClosedByAnotherDevice(true);
            setLiveHeldSale(null);
          } else {
            // If we haven't found it yet, assume it will be found and mark as found
            setDocumentFound(true);
          }
        }
      },
      (error) => {
        console.error('Error listening to held sale:', error);
        // On error, mark as found to prevent false closures
        clearTimeout(docFoundTimeout);
        setDocumentFound(true);
      }
    );

    return () => {
      clearTimeout(docFoundTimeout);
      unsubscribe();
    };
  }, [isOpen, heldSale?.id, firestore, getCollectionPath, documentFound]);

  // Notify user if all items have been printed by another device (but keep dialog open)
  const hasShownAlreadyPrintedToastRef = React.useRef(false);
  React.useEffect(() => {
    if (!isOpen || !liveHeldSale || isPrintingRef.current) return;

    const cart = liveHeldSale.cart || [];
    const hasUnprintedItems = cart.some(item => (item.printedQuantity || 0) < item.sellQuantity);

    if (!hasUnprintedItems && cart.length > 0 && !hasShownAlreadyPrintedToastRef.current) {
      // All items have been printed by another device - notify but keep dialog open
      toast({
        variant: 'default',
        title: 'Already Printed',
        description: 'This receipt has already been printed on another device.',
      });
      hasShownAlreadyPrintedToastRef.current = true;
    }
  }, [liveHeldSale, isOpen, toast]);

  // Reset the toast flag when dialog opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      hasShownAlreadyPrintedToastRef.current = false;
    }
  }, [isOpen]);

  // Handle sale deletion by another device
  React.useEffect(() => {
    if (wasClosedByAnotherDevice && isOpen) {
      toast({
        variant: 'default',
        title: 'Table Closed',
        description: 'This running table has been deleted or reset by another device.',
      });
      onClose();
    }
  }, [wasClosedByAnotherDevice, isOpen, toast, onClose]);

  // Track heldSale changes to detect when the dialog is opened with a new sale
  React.useEffect(() => {
    if (isOpen && heldSale) {
      // Check if this is a different sale than before
      if (!prevHeldSaleRef.current || prevHeldSaleRef.current.id !== heldSale.id) {
        setIsPrinted(false);
        isPrintingRef.current = false;
        prevHeldSaleRef.current = heldSale;
      }
    } else if (!isOpen) {
      // Reset when dialog closes
      prevHeldSaleRef.current = null;
      setLiveHeldSale(null);
      setWasClosedByAnotherDevice(false);
      setDocumentFound(false);
    }
  }, [isOpen, heldSale?.id]);

  const formatCurrency = (value: number) => {
    if (isNaN(value)) return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(0);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  // Use live data if available, otherwise fall back to prop data
  const currentHeldSale = liveHeldSale || heldSale;
  const heldSaleCart = React.useMemo(() => currentHeldSale?.cart ?? [], [currentHeldSale]);
  const unprintedItems = React.useMemo(
    () => heldSaleCart.filter(item => (item.printedQuantity || 0) < item.sellQuantity),
    [heldSaleCart]
  );
  const total = React.useMemo(() => {
    return unprintedItems.reduce((sum, item) => {
      const qtyToPrint = item.sellQuantity - (item.printedQuantity || 0);
      return sum + (item.price || item.sellingPrice || 0) * qtyToPrint;
    }, 0);
  }, [unprintedItems]);
  const heldAtDate = React.useMemo(() => (currentHeldSale ? getSafeDate(currentHeldSale.heldAt) : null), [currentHeldSale]);

  const handlePrint = React.useCallback(() => {
    if (!currentHeldSale) return;
    // Prevent multiple simultaneous prints
    if (isPrintingRef.current || isPrinted || unprintedItems.length === 0) return;

    const printContent = activeTab === 'invoice' ? invoiceRef.current : terminalRef.current;
    if (!printContent) return;

    // Mark as printing immediately to prevent duplicate clicks
    isPrintingRef.current = true;

    const useIframe = !!effectivePosSettings.posAllowPopups;

    // Execute the print
    printHtml(printContent.innerHTML, { title: `New Items Docket - ${currentHeldSale.name}`, useIframe });

    // Update state after print is initiated
    setIsPrinted(true);

    // Call the onPrinted callback and then close the dialog
    if (onPrinted) {
      onPrinted();
      // Close dialog after a short delay to ensure print dialog is shown
      setTimeout(() => {
        onClose();
      }, 100);
    }
  }, [activeTab, isPrinted, unprintedItems.length, currentHeldSale, onPrinted, onClose]);

  if (!currentHeldSale) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Print Unprinted Items</DialogTitle>
          <DialogDescription>
            A consolidated docket for new or remaining items for &ldquo;{currentHeldSale.name}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="terminal">Terminal Docket</TabsTrigger>
            <TabsTrigger value="invoice">Professional Docket</TabsTrigger>
          </TabsList>
          <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
            {unprintedItems.length > 0 ? (
              <>
                <TabsContent value="terminal">
                  <div ref={terminalRef} className="print-content p-4 bg-white text-black receipt max-w-sm mx-auto text-sm">
                    <div className="text-center space-y-1 mb-4">
                      {posLogoUrl && (
                        <img
                          src={posLogoUrl}
                          alt={displayName}
                          style={{ height: `${posLogoSize}px`, width: 'auto' }}
                          className="object-contain mx-auto"
                        />
                      )}
                      {posShowBusinessName && (
                        <h1 className="font-bold text-lg">{displayName}</h1>
                      )}
                      {displayAddress && <p className="text-xs">{displayAddress}</p>}
                      {displayPhone && <p className="text-xs">Tel: {displayPhone}</p>}
                    </div>
                    <div className="text-center text-xs mb-4">
                      {posShowDate && (
                        <p>Date: {heldAtDate ? format(heldAtDate, 'MM/dd/yyyy HH:mm:ss') : 'N/A'}</p>
                      )}
                      <p>Table: {currentHeldSale.name}</p>
                      {posShowCashier && <p>Started by: {currentHeldSale.heldByName || 'N/A'}</p>}
                      <p>Customer: {currentHeldSale.customer?.name || 'Walk-in Customer'}</p>
                    </div>
                    <p className="font-bold uppercase text-center mb-2">NEW ITEMS DOCKET</p>
                    <div className="space-y-1 border-y border-dashed border-black py-2">
                      {unprintedItems.map((item, index) => {
                        const qtyToPrint = item.sellQuantity - (item.printedQuantity || 0);
                        const itemPrice = item.price || item.sellingPrice || 0;
                        return (
                          <div key={index}>
                            <div className="flex justify-between">
                              <span>{item.name}</span>
                              <span>{formatCurrency(itemPrice * qtyToPrint)}</span>
                            </div>
                            <div className="text-xs ml-2">{qtyToPrint} @ {formatCurrency(itemPrice)}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between font-bold text-base pt-2">
                      <span>TOTAL (THIS DOCKET):</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="invoice">
                  <div ref={invoiceRef} className="print-content p-8 bg-white text-black text-sm">
                    <header className="flex justify-between items-start mb-6">
                      <div>
                        {posLogoUrl ? (
                          <img
                            src={posLogoUrl}
                            alt={displayName}
                            style={{ height: `${posLogoSize}px`, width: 'auto' }}
                            className="object-contain"
                          />
                        ) : (
                          <Logo className="h-10 w-10 text-slate-800" />
                        )}
                      </div>
                      <div className="text-right">
                        {posShowBusinessName && (
                          <h1 className="font-bold text-lg text-slate-800">
                            {displayName}
                          </h1>
                        )}
                        {branchAddress && <p className="text-xs text-slate-500">{branchAddress}</p>}
                        {branchPhone && <p className="text-xs text-slate-500">Tel: {branchPhone}</p>}
                      </div>
                    </header>
                    <div className="h-px bg-slate-300 my-4" />
                    <div className="flex justify-between items-center mb-6">
                      <div className="text-left">
                        <h2 className="font-bold text-2xl uppercase text-slate-800">New Items Docket</h2>
                        {posShowDate && (
                          <p className="text-slate-500">
                            Date: {heldAtDate ? format(heldAtDate, 'PPpp') : 'N/A'}
                          </p>
                        )}
                        <p className="text-slate-500">Table: {currentHeldSale.name}</p>
                      </div>
                      <div className="text-right">
                        <h3 className="font-semibold text-slate-600 mb-1">Customer:</h3>
                        <p className="font-bold text-slate-800">
                          {currentHeldSale.customer?.name || 'Walk-in Customer'}
                        </p>
                        {posShowCashier && (
                          <p className="text-slate-500 text-xs">Started by: {currentHeldSale.heldByName || 'N/A'}</p>
                        )}
                      </div>
                    </div>
                    <table className="w-full text-left mb-6">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                        <tr>
                          <th className="p-3">Item</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Price</th>
                          <th className="p-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unprintedItems.map((item, index) => {
                          const qtyToPrint = item.sellQuantity - (item.printedQuantity || 0);
                          const itemPrice = item.price || item.sellingPrice || 0;
                          return (
                            <tr key={index} className="border-b border-slate-100">
                              <td className="p-3">{item.name}</td>
                              <td className="p-3 text-center">{qtyToPrint}</td>
                              <td className="p-3 text-right">{formatCurrency(itemPrice)}</td>
                              <td className="p-3 text-right">{formatCurrency(itemPrice * qtyToPrint)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="flex justify-end">
                      <div className="w-full max-w-xs space-y-2">
                        <div className="flex justify-between font-bold text-lg text-slate-800 border-t-2 border-slate-300 pt-2">
                          <span>Total</span>
                          <span>{formatCurrency(total)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-8 text-center text-xs text-slate-500">
                      <p>This is a docket for preparation and is not a final bill.</p>
                    </div>
                  </div>
                </TabsContent>
              </>
            ) : (
              <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed m-4">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 text-orange-500" />
                <p className="font-medium">No New Items</p>
                <p className="text-sm">All items for this sale have been printed on another device.</p>
              </div>
            )}
          </div>
        </Tabs>

        <DialogFooter className="sm:justify-between flex-row pt-4 gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isPrintingRef.current}>
            <X className="mr-2 h-4 w-4" /> Close
          </Button>
          <Button onClick={handlePrint} disabled={isPrintingRef.current || isPrinted || unprintedItems.length === 0}>
            {isPrintingRef.current ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Printing...
              </>
            ) : isPrinted ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Printed
              </>
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4" />
                Print Docket
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
