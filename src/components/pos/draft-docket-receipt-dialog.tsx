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
import type { HeldSale, UnifiedItem } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, Check, AlertCircle, Sparkles } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { getSafeDate } from '@/lib/helpers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { printHtml, printById } from '@/lib/print-receipt';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface DraftDocketReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  heldSale: HeldSale | null;
  getCollectionPath?: (name: string) => string;
  autoPrintEnabled?: boolean;
  isUpdate?: boolean;
  onReceiptPrinted?: (itemIds: string[]) => void;
}

export function DraftDocketReceiptDialog({
  isOpen,
  onClose,
  heldSale,
  getCollectionPath,
  autoPrintEnabled = true,
  isUpdate = false,
  onReceiptPrinted,
}: DraftDocketReceiptDialogProps) {
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState('terminal');
  const { settings, getEffectivePosSettings } = useSettings();
  const { currentBranch, isGlobalMode } = useBranch();
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isPrinted, setIsPrinted] = React.useState(false);
  const isPrintingRef = React.useRef(false);
  const prevHeldSaleRef = React.useRef<string | null>(null);

  // Real-time state
  const [liveHeldSale, setLiveHeldSale] = React.useState<HeldSale | null>(null);
  const [wasClosedByAnotherDevice, setWasClosedByAnotherDevice] = React.useState(false);
  const [documentFound, setDocumentFound] = React.useState(false);

  // For update dockets: track which items are new (not yet marked as printed)
  const [newItemIds, setNewItemIds] = React.useState<string[]>([]);
  const [displayItems, setDisplayItems] = React.useState<UnifiedItem[]>([]);

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

    // Subscribe to real-time updates for this specific held sale
    // Use the provided getCollectionPath or default fallback for backward compatibility
    const collectionPath = getCollectionPath ? getCollectionPath('heldSales') : 'heldSales';
    const saleRef = doc(firestore, collectionPath, heldSale.id);
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
          // This prevents false positives on initial load when the document path is incorrect
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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  // Use live data if available, otherwise fall back to prop data
  const currentHeldSale = liveHeldSale || heldSale;

  // Process cart items with category separators
  const processedCartItems = React.useMemo(() => {
    const items = currentHeldSale?.cart || [];
    if (items.length === 0) return [];

    // Get settings for separator preference
    const showCategorySeparator = settings?.posShowCategorySeparator !== false;

    if (!showCategorySeparator) return items;

    // Group items by category and add separator info
    const result: (UnifiedItem | { type: 'separator'; category: string })[] = [];
    let lastCategory = '';

    items.forEach((item) => {
      const itemCategory = item.category || 'Uncategorized';

      // Add separator when category changes
      if (itemCategory !== lastCategory && lastCategory !== '') {
        result.push({ type: 'separator', category: itemCategory });
      }

      result.push(item);
      lastCategory = itemCategory;
    });

    return result;
  }, [currentHeldSale?.cart, settings?.posShowCategorySeparator]);

  // Get items for total calculation (filter out separators)
  const cartItems = currentHeldSale?.cart || [];
  const total = cartItems.reduce(
    (sum, item) => sum + (item.price || item.sellingPrice) * Number(item.sellQuantity),
    0
  );
  const heldAtDate = getSafeDate(currentHeldSale?.heldAt);

  // Track heldSale changes to detect when the dialog is opened with a new sale
  React.useEffect(() => {
    if (isOpen && currentHeldSale) {
      if (!prevHeldSaleRef.current || prevHeldSaleRef.current !== currentHeldSale.id) {
        setIsPrinted(false);
        isPrintingRef.current = false;
        prevHeldSaleRef.current = currentHeldSale.id;
      }
    } else if (!isOpen) {
      prevHeldSaleRef.current = null;
      setLiveHeldSale(null);
      setWasClosedByAnotherDevice(false);
      setDocumentFound(false);
    }
  }, [isOpen, currentHeldSale?.id]);

  // Auto-print logic for update dockets
  const hasUnprintedItems = React.useMemo(() => {
    if (!currentHeldSale) return false;
    const cart = currentHeldSale?.cart || [];
    return cart.some(item => (item.printedQuantity || 0) < item.sellQuantity);
  }, [currentHeldSale]);

  const handleAutoPrint = React.useCallback(async () => {
    if (isPrintingRef.current || isPrinted || !autoPrintEnabled) return;
    if (!currentHeldSale || !isUpdate) return;

    const useIframe = !!effectivePosSettings.posAllowPopups;
    isPrintingRef.current = true;

    // Print using terminal format by default
    printById('draft-docket-terminal-print', {
      title: `Update Docket - ${currentHeldSale.name}`,
      useIframe
    });

    setIsPrinted(true);

    // Mark items as printed if callback provided
    if (onReceiptPrinted && cartItems.length > 0) {
      const itemIds = cartItems.map(item => item.id);
      onReceiptPrinted(itemIds);

      // Update the held sale document to mark items as printed
      if (firestore) {
        try {
          const saleRef = doc(firestore, getCollectionPath ? getCollectionPath('heldSales') : 'heldSales', currentHeldSale.id);
          const cart = currentHeldSale?.cart || [];
          const updatedCart = cart.map(item => ({
            ...item,
            printedQuantity: item.sellQuantity,
          }));
          await updateDoc(saleRef, { cart: updatedCart });
        } catch (error) {
          console.error('Failed to update print status:', error);
        }
      }
    }

    // Close dialog after short delay
    setTimeout(() => {
      onClose();
    }, 100);
  }, [autoPrintEnabled, isUpdate, currentHeldSale, cartItems, onReceiptPrinted, firestore, getCollectionPath, onClose]);

  // Auto-print when dialog opens with update mode and auto-print enabled
  React.useEffect(() => {
    if (isOpen && isUpdate && currentHeldSale && autoPrintEnabled && !isPrinted && hasUnprintedItems) {
      // Small delay to ensure the DOM is fully rendered
      const timer = setTimeout(() => {
        handleAutoPrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isUpdate, autoPrintEnabled, hasUnprintedItems, currentHeldSale]);

  const handlePrint = React.useCallback(async () => {
    if (isPrintingRef.current || isPrinted) return;

    const printContent = activeTab === 'invoice' ? invoiceRef.current : terminalRef.current;
    if (!printContent) return;

    const useIframe = !!effectivePosSettings.posAllowPopups;
    isPrintingRef.current = true;

    printHtml(printContent.innerHTML, { title: `Draft Docket - ${currentHeldSale?.name}`, useIframe });

    setIsPrinted(true);

    // Mark items as printed after print
    if (isUpdate && onReceiptPrinted && cartItems.length > 0 && firestore && currentHeldSale) {
      const itemIds = cartItems.map(item => item.id);
      onReceiptPrinted(itemIds);

      // Update the held sale document to mark items as printed
      try {
        const saleRef = doc(firestore, getCollectionPath ? getCollectionPath('heldSales') : 'heldSales', currentHeldSale.id);
        const cart = currentHeldSale?.cart || [];
        const updatedCart = cart.map(item => ({
          ...item,
          printedQuantity: item.sellQuantity,
        }));
        await updateDoc(saleRef, { cart: updatedCart });
      } catch (error) {
        console.error('Failed to update print status:', error);
      }
    }

    setTimeout(() => {
      onClose();
    }, 100);
  }, [activeTab, isPrinted, currentHeldSale?.name, onClose, isUpdate, cartItems, onReceiptPrinted, firestore, getCollectionPath]);

  if (!currentHeldSale) return null;

  // Determine dialog title based on mode
  const dialogTitle = isUpdate ? 'Update Docket' : 'Print Draft Docket';
  const dialogDescription = isUpdate
    ? `New items added to running table "${currentHeldSale.name}". Receipt will be auto-printed.`
    : `A draft receipt for the running table "${currentHeldSale.name}". This will not mark items as printed.`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {dialogTitle}
            {isUpdate && isPrinted && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <Sparkles className="h-3 w-3 mr-1" />
                Auto-Printed
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="terminal">Terminal Docket</TabsTrigger>
            <TabsTrigger value="invoice">Professional Docket</TabsTrigger>
          </TabsList>
          <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
            <TabsContent value="terminal">
              <div id="draft-docket-terminal-print" ref={terminalRef} className="print-content p-4 bg-white text-black receipt max-w-sm mx-auto text-sm">
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
                  {posShowCashier && <p>Started By: {currentHeldSale.heldByName}</p>}
                  <p>Customer: {currentHeldSale.customer?.name || 'Walk-in Customer'}</p>
                </div>
                <p className="font-bold uppercase text-center mb-2 text-red-600">
                  {isUpdate ? 'NEW ITEMS' : 'NOT PAID DRAFT Bill'}
                </p>
                <p className="font-bold uppercase text-center mb-2">{currentHeldSale.name}</p>
                <div className="border-y border-dashed border-black py-2">
                  {processedCartItems.map((item, index) => {
                    // Check if this is a separator
                    if ('type' in item && item.type === 'separator') {
                      return (
                        <div key={`sep-${index}`} className="border-t border-dashed border-gray-400 my-2 pt-2">
                          <span className="text-xs font-semibold text-gray-600 uppercase">{item.category}</span>
                        </div>
                      );
                    }

                    const cartItem = item as UnifiedItem;
                    return (
                      <div key={index} className="border-b border-dashed border-gray-300 py-1 last:border-b-0">
                        <div className="flex justify-between">
                          <span>{cartItem.name}</span>
                          <span>
                            {formatCurrency((cartItem.price || cartItem.sellingPrice) * Number(cartItem.sellQuantity))}
                          </span>
                        </div>
                        <div className="text-xs ml-2">
                          {cartItem.sellQuantity} @ {formatCurrency(cartItem.price || cartItem.sellingPrice)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between font-bold text-base pt-2">
                  <span>{isUpdate ? 'NEW ITEMS TOTAL:' : 'TOTAL:'}</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <div className="text-center text-xs mt-6 text-red-600 font-semibold">
                  <p>{isUpdate ? 'UPDATE DOCKET' : 'NOT PAID DRAFT Bill'}</p>
                  <p className="mt-1 text-black font-normal">This is not a final receipt</p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="invoice">
              <div ref={invoiceRef} className="print-content p-8 bg-white text-black text-sm">
                <h2 className="font-bold text-2xl text-center mb-4 text-red-600">
                  {isUpdate ? 'UPDATE ORDER' : 'NOT PAID DRAFT Bill'}
                </h2>
                <p><strong>Table Name:</strong> {currentHeldSale.name}</p>
                <p><strong>Date:</strong> {heldAtDate ? format(heldAtDate, 'PPpp') : 'N/A'}</p>
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
                    {processedCartItems.map((item, i) => {
                      // Check if this is a separator
                      if ('type' in item && item.type === 'separator') {
                        return (
                          <tr key={`sep-${i}`}>
                            <td colSpan={4} className="p-2 pt-4 font-semibold text-gray-600 uppercase text-xs border-t-2 border-gray-300">
                              {item.category}
                            </td>
                          </tr>
                        );
                      }

                      const cartItem = item as UnifiedItem;
                      const itemPrice = cartItem.price || cartItem.sellingPrice;
                      return (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="p-3">{cartItem.name}</td>
                          <td className="p-3 text-center">{cartItem.sellQuantity}</td>
                          <td className="p-3 text-right">{formatCurrency(itemPrice)}</td>
                          <td className="p-3 text-right">{formatCurrency(itemPrice * Number(cartItem.sellQuantity))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex justify-end">
                  <div className="w-full max-w-xs space-y-2">
                    <div className="flex justify-between font-bold text-lg border-t-2 border-gray-300 pt-2">
                      <span>{isUpdate ? 'New Items Total' : 'Total'}</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 text-center text-red-600 font-semibold text-sm">
                  <p>{isUpdate ? 'UPDATE DOCKET' : 'NOT PAID DRAFT Bill'}</p>
                  <p className="mt-1 text-black font-normal">This is not a final receipt</p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="sm:justify-between flex-row pt-4">
          <Button variant="ghost" onClick={onClose} disabled={isPrintingRef.current}>
            <X className="mr-2 h-4 w-4" /> Close
          </Button>
          {isUpdate ? (
            <Button variant="secondary" onClick={onClose} disabled={isPrintingRef.current}>
              Done
            </Button>
          ) : (
          <Button onClick={handlePrint} disabled={isPrintingRef.current || isPrinted}>
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
                Print Draft Docket
              </>
            )}
          </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
