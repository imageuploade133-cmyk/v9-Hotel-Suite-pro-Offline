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
import { Badge } from '@/components/ui/badge';
import type { HeldSale, UnifiedItem } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, Check, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { getSafeDate } from '@/lib/helpers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { printById } from '@/lib/print-receipt';
import { useSecurePrint } from '@/lib/secure-print';
import { useUser } from '@/contexts/user-context';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface HeldSaleReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  heldSale: HeldSale | null;
  onPrintAllUnprinted?: (itemsToUpdate: any[]) => void;
  onPrinted?: () => void;
  newItemsOnly?: UnifiedItem[];
  onMarkPrinted?: (itemIds: string[]) => void;
}

export function HeldSaleReceiptDialog({
  isOpen,
  onClose,
  heldSale,
  onPrintAllUnprinted,
  onPrinted,
  newItemsOnly,
  onMarkPrinted,
}: HeldSaleReceiptDialogProps) {
  const [activeTab, setActiveTab] = React.useState('terminal');
  const { settings, getEffectivePosSettings } = useSettings();
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isPrinted, setIsPrinted] = React.useState(false);
  const isPrintingRef = React.useRef(false);
  const prevHeldSaleRef = React.useRef<string | null>(null);
  const { userProfile } = useUser();
  const { currentBranch, getCollectionPath, isGlobalMode } = useBranch();

  // Real-time state for the held sale
  const [liveHeldSale, setLiveHeldSale] = React.useState<HeldSale | null>(null);
  const [wasClosedByAnotherDevice, setWasClosedByAnotherDevice] = React.useState(false);

  // Secure print integration for held sales (running table dockets)
  // Note: For held sales, we track print status per docket print, not per sale
  // This is because held sales can have multiple dockets printed over time
  const isUpdateDocket = !!(newItemsOnly && newItemsOnly.length > 0);

  // We only use secure print for the full docket, not update dockets
  // allowReprintAfterDelay is true to allow reprinting after 5 seconds (for running tables)
  // Pass the actual values - the hook handles validation internally
  // Use getCollectionPath to get the correct collection path based on branch/POS mode
  const {
    isAlreadyPrinted: isDocketAlreadyPrinted,
    isProcessing: isSecurePrintProcessing,
    handlePrint: handleSecurePrint,
    isValid
  } = useSecurePrint({
    collection: getCollectionPath('heldSales'),
    documentId: !isUpdateDocket && heldSale?.id ? heldSale.id : '',
    allowReprintAfterDelay: true,
  });

  const terminalRef = React.useRef<HTMLDivElement>(null);
  const invoiceRef = React.useRef<HTMLDivElement>(null);

  const currency = settings?.currency || 'USD';

  // Get effective POS settings based on current context (Global vs Branch)
  const effectivePosSettings = getEffectivePosSettings();

  // Use effective POS settings with proper separation between Global and Branch
  const posLogoUrl = effectivePosSettings.posUseBusinessLogo !== false
    ? (effectivePosSettings.posReceiptLogoUrl || settings?.businessLogoUrl || '')
    : (effectivePosSettings.posReceiptLogoUrl || settings?.businessLogoUrl || '');
  const posLogoSize = effectivePosSettings.posReceiptLogoSize || settings?.businessLogoSize || 48;
  const posHeader = effectivePosSettings.posReceiptHeader || 'DRAFT - RUNNING TABLE';
  const posFooter = effectivePosSettings.posReceiptFooter || 'THIS IS NOT A FINAL RECEIPT';
  const posShowBusinessName = effectivePosSettings.posShowBusinessName !== false;
  const posShowDate = effectivePosSettings.posShowDate !== false;
  const posShowCashier = effectivePosSettings.posShowCashierName !== false;

  // Set up real-time listener for the held sale document
  React.useEffect(() => {
    if (!isOpen || !heldSale || !firestore) {
      setLiveHeldSale(null);
      setWasClosedByAnotherDevice(false);
      return;
    }

    // Reset state when dialog opens
    setWasClosedByAnotherDevice(false);

    // Subscribe to real-time updates for this specific held sale using the correct collection path
    const saleRef = doc(firestore, getCollectionPath('heldSales'), heldSale.id);
    const unsubscribe = onSnapshot(
      saleRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = { id: docSnapshot.id, ...docSnapshot.data() } as HeldSale;
          setLiveHeldSale(data);
        } else {
          // Document was deleted (table was reset/deleted by another device)
          setWasClosedByAnotherDevice(true);
          setLiveHeldSale(null);
        }
      },
      (error) => {
        console.error('Error listening to held sale:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isOpen, heldSale?.id, firestore, getCollectionPath]);

  // Use live data if available, otherwise fall back to prop data
  const currentHeldSale = liveHeldSale || heldSale;
  const heldSaleCart = React.useMemo(() => currentHeldSale?.cart ?? [], [currentHeldSale]);

  const itemsToDisplay = React.useMemo(() => {
    if (newItemsOnly && newItemsOnly.length > 0) return newItemsOnly;
    if (!currentHeldSale) return [];
    return heldSaleCart;
  }, [newItemsOnly, currentHeldSale, heldSaleCart]);

  const displayItems = React.useMemo(
    () => itemsToDisplay.filter((item): item is UnifiedItem => Boolean(item)),
    [itemsToDisplay]
  );

  const hasUnprintedItems = React.useMemo(() => {
    if (isUpdateDocket) return displayItems.length > 0;
    if (!currentHeldSale) return false;
    return heldSaleCart.some(item => (item.printedQuantity || 0) < item.sellQuantity);
  }, [currentHeldSale, heldSaleCart, displayItems, isUpdateDocket]);

  const hasItemsToPrint = displayItems.length > 0;

  // Notify user if all items have been printed by another device (but keep dialog open)
  const hasShownAlreadyPrintedToastRef = React.useRef(false);
  React.useEffect(() => {
    if (!isOpen || !liveHeldSale || isPrintingRef.current || isUpdateDocket) return;

    const cart = liveHeldSale.cart || [];
    const allItemsPrinted = cart.length > 0 && cart.every(item => (item.printedQuantity || 0) >= item.sellQuantity);

    if (allItemsPrinted && !hasShownAlreadyPrintedToastRef.current) {
      // All items have been printed by another device - notify but keep dialog open
      toast({
        variant: 'default',
        title: 'Already Printed',
        description: 'This receipt has already been printed on another device.',
      });
      hasShownAlreadyPrintedToastRef.current = true;
    }
  }, [liveHeldSale, isOpen, isUpdateDocket, toast]);

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

  // Check if auto-print for table updates is enabled in settings
  const autoPrintEnabled = settings?.posAutoPrintTableUpdates !== false; // Default to true if not set

  // Auto-print handler for update dockets - defined before useEffect to avoid dependency issues
  const handleAutoPrint = React.useCallback(async () => {
    if (isPrintingRef.current || !hasItemsToPrint || !hasUnprintedItems) return;
    if (!currentHeldSale || !userProfile) return;
    // Respect the auto-print setting - if disabled, don't auto-print
    if (!autoPrintEnabled) return;

    // Use terminal docket as default for auto-print
    const elementId = 'held-sale-terminal-print';

    // Mark as printing immediately to prevent duplicate prints
    isPrintingRef.current = true;

    const useIframe = !!effectivePosSettings.posAllowPopups;

    // For update dockets, print directly without secure print (these are allowed multiple times)
    printById(elementId, {
      title: 'Update Docket',
      useIframe
    });

    setIsPrinted(true);

    // Execute callbacks after print is initiated
    if (onMarkPrinted && displayItems.length > 0) {
      onMarkPrinted(displayItems.map(item => item.id));
    }
    if (onPrinted) {
      onPrinted();
    }
  }, [hasItemsToPrint, hasUnprintedItems, currentHeldSale, userProfile, displayItems, onMarkPrinted, onPrinted, autoPrintEnabled]);

  React.useEffect(() => {
    const saleId = currentHeldSale?.id || (newItemsOnly?.length > 0 ? 'update' : null);

    if (isOpen && saleId) {
      // Check if this is a different sale than before
      if (!prevHeldSaleRef.current || prevHeldSaleRef.current !== saleId) {
        setIsPrinted(false);
        isPrintingRef.current = false;
        prevHeldSaleRef.current = saleId;

        // Auto-print for update dockets when dialog opens (only if enabled in settings)
        // This ensures the receipt is automatically generated when a table is updated
        if (isUpdateDocket && hasItemsToPrint && hasUnprintedItems && autoPrintEnabled) {
          // Small delay to ensure the DOM is fully rendered
          setTimeout(() => {
            handleAutoPrint();
          }, 500);
        }
      }
    } else if (!isOpen) {
      // Reset when dialog closes
      prevHeldSaleRef.current = null;
      setLiveHeldSale(null);
      setWasClosedByAnotherDevice(false);
    }
  }, [isOpen, currentHeldSale?.id, newItemsOnly?.length, isUpdateDocket, hasItemsToPrint, hasUnprintedItems, handleAutoPrint, autoPrintEnabled]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const heldAtDate = currentHeldSale ? getSafeDate(currentHeldSale.heldAt) : new Date();
  const total = displayItems.reduce(
    (sum, item) => sum + (item.price || item.sellingPrice) * Number(item.sellQuantity),
    0
  );

  const docketTitle = isUpdateDocket ? 'UPDATE DOCKET' : posHeader;
  const docketDescription = isUpdateDocket
    ? isPrinted
      ? `Receipt auto-printed for new items added to "${currentHeldSale?.name || 'Table'}". You can close this dialog or reprint if needed.`
      : `New items added to "${currentHeldSale?.name || 'Table'}"`
    : `A draft receipt for the running table "${currentHeldSale?.name || 'Table'}".`;

  const handlePrint = React.useCallback(async () => {
    // Prevent multiple simultaneous prints
    if (isPrintingRef.current || isPrinted || !hasItemsToPrint || !hasUnprintedItems) return;
    if (!currentHeldSale || !userProfile) return;

    const elementId = activeTab === 'invoice' ? 'held-sale-invoice-print' : 'held-sale-terminal-print';

    // Mark as printing immediately to prevent duplicate clicks
    isPrintingRef.current = true;

    // For update dockets, don't use secure print (these are allowed multiple times)
    // For full dockets, use secure print to prevent duplicate printing
    if (isUpdateDocket) {
      printById(elementId, {
        title: 'Update Docket'
      });

      setIsPrinted(true);

      // Execute callbacks after print is initiated
      if (onMarkPrinted && displayItems.length > 0) {
        onMarkPrinted(displayItems.map(item => item.id));
      }
      if (onPrinted) {
        onPrinted();
        // Close dialog after a short delay to ensure print dialog is shown
        setTimeout(() => {
          onClose();
        }, 100);
      }
    } else {
      // Use secure print for full dockets to prevent duplicate printing
      await handleSecurePrint(
        userProfile.uid,
        userProfile.name,
        () => {
          printById(elementId, {
            title: 'Running Table Docket',
            useIframe
          });

          setIsPrinted(true);

          if (onMarkPrinted && displayItems.length > 0) {
            onMarkPrinted(displayItems.map(item => item.id));
          }
          if (onPrinted) {
            onPrinted();
            // Close dialog after a short delay to ensure print dialog is shown
            setTimeout(() => {
              onClose();
            }, 100);
          }
        }
      );
    }
  }, [
    isPrinted,
    hasItemsToPrint,
    hasUnprintedItems,
    currentHeldSale,
    userProfile,
    activeTab,
    isUpdateDocket,
    displayItems,
    onMarkPrinted,
    onPrinted,
    onClose,
    handleSecurePrint,
  ]);

  // Early return after all hooks to satisfy React's Rules of Hooks
  if (!currentHeldSale && !newItemsOnly) return null;

  // Check if all items are already printed (for full docket view)
  const allItemsAlreadyPrinted = !isUpdateDocket && heldSaleCart.length > 0 &&
    heldSaleCart.every(item => (item.printedQuantity || 0) >= item.sellQuantity);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isUpdateDocket ? 'Update Docket' : 'Running Table Docket'}
            {isUpdateDocket && isPrinted && (
              <Badge variant="default" className="bg-green-500 text-white">
                <Sparkles className="h-3 w-3 mr-1" />
                Auto-Printed
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>{docketDescription}</DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="terminal">Terminal Docket</TabsTrigger>
            <TabsTrigger value="invoice">Professional Docket</TabsTrigger>
          </TabsList>
          <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
            {!hasUnprintedItems && !isUpdateDocket ? (
              <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed m-4">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 text-orange-500" />
                <p className="font-medium">All Items Printed</p>
                <p className="text-sm">All items for this table have already been printed on another device.</p>
              </div>
            ) : (
              <>
                <TabsContent value="terminal">
                  <div id="held-sale-terminal-print" ref={terminalRef} className="print-content p-4 bg-white text-black receipt max-w-sm mx-auto text-sm">
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
                        <h1 className="font-bold text-lg">{isGlobalMode ? settings?.businessName : (currentBranch?.name || settings?.businessName || 'Hotel Suite Pro')}</h1>
                      )}
                      {currentBranch?.address && !isGlobalMode && (
                        <p className="text-xs">{currentBranch.address}</p>
                      )}
                    </div>
                    <div className="text-center text-xs mb-4">
                      {posShowDate && (
                        <p>Date: {heldAtDate ? format(heldAtDate, 'MM/dd/yyyy HH:mm:ss') : 'N/A'}</p>
                      )}
                      {posShowCashier && currentHeldSale && <p>Started By: {currentHeldSale.heldByName}</p>}
                      {currentHeldSale && (
                        <p>Customer: {currentHeldSale.customer?.name || 'Walk-in Customer'}</p>
                      )}
                      {currentHeldSale?.isCreditSale && currentHeldSale.linkedStockSaleNumber && (
                        <p className="text-amber-600">Credit Sale #: {currentHeldSale.linkedStockSaleNumber}</p>
                      )}
                    </div>
                    <p className="font-bold uppercase text-center mb-2">
                      {docketTitle}: {currentHeldSale?.name || 'Table'}
                    </p>
                    {currentHeldSale?.isCreditSale && (
                      <p className="text-center text-xs text-amber-600 mb-2">CREDIT SALE - PAYMENT PENDING</p>
                    )}
                    <div className="border-y border-dashed border-black py-2">
                      {displayItems.map((item, index) => (
                        <div key={index} className="border-b border-dashed border-gray-300 py-1 last:border-b-0">
                          <div className="flex justify-between">
                            <span>{item.name}</span>
                            <span>
                              {formatCurrency((item.price || item.sellingPrice) * Number(item.sellQuantity))}
                            </span>
                          </div>
                          <div className="text-xs ml-2">
                            {item.sellQuantity} @ {formatCurrency(item.price || item.sellingPrice)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between font-bold text-base pt-2">
                      <span>{isUpdateDocket ? 'NEW ITEMS TOTAL:' : 'TOTAL:'}</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                    <div className="text-center text-xs mt-6 whitespace-pre-line">
                      <p>{posFooter}</p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="invoice">
                  <div id="held-sale-invoice-print" ref={invoiceRef} className="print-content p-8 bg-white text-black text-sm">
                    <h2 className="font-bold text-2xl text-center mb-4">
                      {isUpdateDocket ? 'UPDATE ORDER' : 'DRAFT ORDER'}
                    </h2>
                    {currentHeldSale && <p><strong>Table Name:</strong> {currentHeldSale.name}</p>}
                    {currentHeldSale?.isCreditSale && currentHeldSale.linkedStockSaleNumber && (
                      <p className="text-amber-600"><strong>Credit Sale #:</strong> {currentHeldSale.linkedStockSaleNumber}</p>
                    )}
                    {currentBranch?.address && !isGlobalMode && <p className="text-sm"><strong>Location:</strong> {currentBranch.address}</p>}
                    <p><strong>Date:</strong> {heldAtDate ? format(heldAtDate, 'PPpp') : 'N/A'}</p>
                    {currentHeldSale?.isCreditSale && (
                      <p className="text-amber-600 mt-2"><strong>⚠ CREDIT SALE - PAYMENT PENDING</strong></p>
                    )}
                    <hr className="my-4" />
                    <table className="w-full text-left mb-6">
                      <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                        <tr>
                          <th className="p-3">Item</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Price</th>
                          <th className="p-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayItems.map((item, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="p-3">{item.name}</td>
                            <td className="p-3 text-center">{item.sellQuantity}</td>
                            <td className="p-3 text-right">{formatCurrency(item.price || item.sellingPrice)}</td>
                            <td className="p-3 text-right">{formatCurrency((item.price || item.sellingPrice) * Number(item.sellQuantity))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-end">
                      <div className="w-full max-w-xs space-y-2">
                        <div className="flex justify-between font-bold text-lg border-t-2 border-gray-300 pt-2">
                          <span>{isUpdateDocket ? 'New Items Total' : 'Total'}</span>
                          <span>{formatCurrency(total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
        <DialogFooter className="sm:justify-between flex-row pt-4">
          <Button variant="ghost" onClick={onClose} disabled={isPrintingRef.current || isSecurePrintProcessing}>
            <X className="mr-2 h-4 w-4" /> Close
          </Button>
          {allItemsAlreadyPrinted || (isDocketAlreadyPrinted && !isUpdateDocket) ? (
            <Button variant="secondary" disabled className="bg-muted text-muted-foreground cursor-not-allowed">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Already Printed
            </Button>
          ) : (
            <Button
              onClick={handlePrint}
              disabled={isPrintingRef.current || isPrinted || !hasItemsToPrint || !hasUnprintedItems || isSecurePrintProcessing || !isValid}
            >
              {(isPrintingRef.current || isSecurePrintProcessing) ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Printing...
                </>
              ) : isPrinted ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Printed
                </>
              ) : (
                <>
                  <Printer className="mr-2 h-4 w-4" /> Print
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
