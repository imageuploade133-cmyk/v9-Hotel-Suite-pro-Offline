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
import { Separator } from '../ui/separator';
import type { HeldSale, StockItem } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, Check, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { getSafeDate } from '@/lib/helpers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Logo } from '../logo';
import { printById } from '@/lib/print-receipt';
import { useSecurePrint } from '@/lib/secure-print';
import { useUser } from '@/contexts/user-context';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/branch-context';

interface CartItem extends StockItem {
  sellQuantity: number;
  printedQuantity?: number;
  name: string;
  sellingPrice: number;
}

interface SingleItemReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sale: HeldSale | null;
  item: CartItem | null;
  onSuccess?: (qty: number) => void;
}

export function SingleItemReceiptDialog({ isOpen, onClose, sale, item, onSuccess }: SingleItemReceiptDialogProps) {
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState('terminal');
  const { settings, getEffectivePosSettings } = useSettings();
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isPrinted, setIsPrinted] = React.useState(false);
  const { userProfile } = useUser();

  // Real-time state
  const [liveItemPrintedQty, setLiveItemPrintedQty] = React.useState<number | null>(null);
  const [wasClosedByAnotherDevice, setWasClosedByAnotherDevice] = React.useState(false);
  const [documentFound, setDocumentFound] = React.useState(false);
  const { getCollectionPath, currentBranch, isGlobalMode } = useBranch();

  // Secure print integration for single item dockets
  // Pass the actual values - the hook handles validation internally
  // allowReprintAfterDelay is true to allow reprinting after 5 seconds
  // Use getCollectionPath to get the correct collection path based on branch/POS mode
  const {
    isAlreadyPrinted,
    isProcessing: isSecurePrintProcessing,
    handlePrint: handleSecurePrint,
    isValid
  } = useSecurePrint({
    collection: getCollectionPath('heldSales'),
    documentId: sale?.id || '',
    allowReprintAfterDelay: true,
  });

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
    if (!isOpen || !sale || !item || !firestore) {
      setLiveItemPrintedQty(null);
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

    // Subscribe to real-time updates for this specific held sale using branch-aware path
    const saleRef = doc(firestore, getCollectionPath('heldSales'), sale.id);
    const unsubscribe = onSnapshot(
      saleRef,
      (docSnapshot) => {
        clearTimeout(docFoundTimeout);
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as HeldSale;
          const cartItem = data.cart?.find(c => c.id === item.id);
          if (cartItem) {
            setLiveItemPrintedQty(cartItem.printedQuantity || 0);
          }
          setDocumentFound(true);
        } else {
          // Only trigger "closed by another device" if we already found the document before
          // This prevents false positives on initial load when the document path is resolving
          if (documentFound) {
            setWasClosedByAnotherDevice(true);
            setLiveItemPrintedQty(null);
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
  }, [isOpen, sale?.id, item?.id, firestore, getCollectionPath, documentFound]);

  // Check if item has been fully printed by another device
  React.useEffect(() => {
    if (!isOpen || !item || liveItemPrintedQty === null) return;

    const sellQty = Number(item.sellQuantity);
    const currentPrintedQty = liveItemPrintedQty;
    const remainingQty = Math.max(0, sellQty - currentPrintedQty);

    if (remainingQty === 0 && !isPrinted) {
      // Item has been fully printed by another device
      toast({
        variant: 'default',
        title: 'Already Printed',
        description: 'This item has already been printed on another device.',
      });
      onClose();
    }
  }, [liveItemPrintedQty, isOpen, item, isPrinted, toast, onClose]);

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

  React.useEffect(() => {
    if (isOpen) {
      setIsPrinted(false);
    } else {
      // Reset live data when dialog closes
      setLiveItemPrintedQty(null);
      setWasClosedByAnotherDevice(false);
      setDocumentFound(false);
    }
  }, [isOpen]);

  if (!sale || !item) return null;

  const sellQty = Number(item.sellQuantity);
  // Use live data if available, otherwise fall back to prop data
  const printedQty = liveItemPrintedQty !== null ? liveItemPrintedQty : (item.printedQuantity || 0);
  const qtyToPrint = Math.max(0, sellQty - printedQty);
  const isFullyPrinted = qtyToPrint === 0;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const handlePrint = async () => {
    if (isPrinted || qtyToPrint <= 0 || !item || !userProfile) return;

    const elementId = activeTab === 'invoice' ? 'single-item-invoice-print' : 'single-item-terminal-print';

    const useIframe = !!effectivePosSettings.posAllowPopups;

    // Use secure print to prevent duplicate printing
    await handleSecurePrint(
      userProfile.uid,
      userProfile.name,
      () => {
        printById(elementId, { title: `Item Docket - ${item.name}`, useIframe });
        setIsPrinted(true);
        if (onSuccess) onSuccess(qtyToPrint);
      }
    );
  };

  const heldAtDate = getSafeDate(sale.heldAt);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isPrinted) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Item Draft Docket</DialogTitle>
          <DialogDescription>
            {qtyToPrint > 0
              ? `Printing a docket for ${qtyToPrint} x "${item.name}".`
              : 'All items have already been printed on another device.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="terminal">Terminal Docket</TabsTrigger>
            <TabsTrigger value="invoice">Professional Docket</TabsTrigger>
          </TabsList>
          <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
            {qtyToPrint > 0 ? (
              <>
                <TabsContent value="terminal">
                  <div id="single-item-terminal-print" ref={terminalRef} className="print-content p-4 bg-white text-black receipt max-w-sm mx-auto text-sm">
                    <div className="text-center mb-4 space-y-1">
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
                      <p>Table: {sale.name}</p>
                      {posShowCashier && <p>Started by: {sale.heldByName || 'N/A'}</p>}
                      <p>Customer: {sale.customer?.name || 'Walk-in Customer'}</p>
                    </div>
                    <p className="font-bold uppercase text-center mb-2 text-xl">DOCKET: {item.name}</p>
                    <p className="font-bold uppercase text-center mb-2 text-3xl">QTY: {qtyToPrint}</p>
                    <div className="text-center text-xs mt-6">
                      <p>This is a draft for a single item from a running table.</p>
                      <p>No payment has been processed.</p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="invoice">
                  <div id="single-item-invoice-print" ref={invoiceRef} className="print-content p-8 bg-white text-black text-sm">
                    <header className="text-center mb-6">
                      {posLogoUrl ? (
                        <img
                          src={posLogoUrl}
                          alt={settings?.businessName || 'logo'}
                          style={{ height: `${posLogoSize}px`, width: 'auto' }}
                          className="object-contain mx-auto"
                        />
                      ) : (
                        <Logo className="h-10 w-10 text-slate-800 mx-auto" />
                      )}
                      {posShowBusinessName && (
                        <h1 className="font-bold text-lg text-slate-800 mt-2">
                          {displayName}
                        </h1>
                      )}
                    </header>
                    <Separator className="my-4" />
                    <div className="flex justify-between items-center mb-6">
                      <div className="text-left">
                        <h2 className="font-bold text-2xl uppercase text-slate-800">Kitchen/Bar Docket</h2>
                        <p className="text-slate-500">Table Ref: {sale.name}</p>
                        <p className="text-slate-500">
                          Date: {heldAtDate ? format(heldAtDate, 'PPpp') : 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <h3 className="font-semibold text-slate-600 mb-1">Customer:</h3>
                        <p className="font-bold text-slate-800">
                          {sale.customer?.name || 'Walk-in Customer'}
                        </p>
                      </div>
                    </div>
                    <div className="text-center my-8">
                      <p className="text-lg text-slate-500">ITEM</p>
                      <h3 className="text-4xl font-bold text-slate-800">{item.name}</h3>
                    </div>
                    <div className="text-center my-8">
                      <p className="text-lg text-slate-500">QUANTITY</p>
                      <h3 className="text-6xl font-bold text-slate-800">{qtyToPrint}</h3>
                    </div>
                    <div className="mt-12 text-center text-xs text-slate-500">
                      <p>This is a docket for preparation and is not a final bill.</p>
                    </div>
                  </div>
                </TabsContent>
              </>
            ) : (
              <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed m-4">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 text-orange-500" />
                <p className="font-medium">Already Printed</p>
                <p className="text-sm">All {sellQty} items have already been printed on another device.</p>
              </div>
            )}
          </div>
        </Tabs>

        <DialogFooter className="sm:justify-between flex-row pt-4 gap-2">
          <Button variant="ghost" onClick={onClose}>
            <X className="mr-2 h-4 w-4" /> {isPrinted ? 'Close' : 'Cancel'}
          </Button>
          {isFullyPrinted || (isAlreadyPrinted && qtyToPrint > 0) ? (
            <Button variant="secondary" disabled className="bg-muted text-muted-foreground cursor-not-allowed">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Already Printed
            </Button>
          ) : (
            <Button onClick={handlePrint} disabled={isPrinted || qtyToPrint <= 0 || isSecurePrintProcessing || !isValid}>
              {isSecurePrintProcessing ? (
                <>
                  <Printer className="mr-2 h-4 w-4 animate-spin" /> Printing...
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
