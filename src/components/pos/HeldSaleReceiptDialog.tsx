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
import { format } from 'date-fns';
import { Printer, X, Check } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { getSafeDate } from '@/lib/helpers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { printHtml } from '@/lib/print-receipt';

interface CartItem {
  id: string;
  name: string;
  sellQuantity: number;
  sellingPrice: number;
  printedQuantity?: number;
}

interface HeldSaleReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  heldSale: HeldSale | null;
  onPrintAllUnprinted?: (itemsToUpdate: CartItem[]) => void;
  onPrinted?: () => void;
}

export function HeldSaleReceiptDialog({
  isOpen,
  onClose,
  heldSale,
  onPrintAllUnprinted,
  onPrinted,
}: HeldSaleReceiptDialogProps) {
  const [activeTab, setActiveTab] = React.useState('terminal');
  const { settings } = useSettings();
  const { currentBranch, isGlobalMode } = useBranch();
  const [isPrinted, setIsPrinted] = React.useState(false);

  const terminalRef = React.useRef<HTMLDivElement>(null);
  const invoiceRef = React.useRef<HTMLDivElement>(null);

  const currency = settings?.currency || 'USD';
  const logoSize = settings?.businessLogoSize || 48;

  // Use branch-specific information if available, otherwise fall back to global settings
  // In global mode, use the POS Receipt Settings business name instead of "Global Branch"
  const displayLogoUrl = currentBranch?.logoUrl || settings?.businessLogoUrl;
  const displayName = isGlobalMode ? (settings?.businessName || 'Hotel Suite Pro') : (currentBranch?.name || settings?.businessName || 'Hotel Suite Pro');
  const displayAddress = isGlobalMode ? undefined : currentBranch?.address;
  const displayPhone = isGlobalMode ? undefined : currentBranch?.phoneNumber;

  const allItemsPrinted = React.useMemo(() => {
    if (!heldSale) return false;
    const cart = heldSale.cart || [];
    return cart.length > 0 && cart.every(item => (item.printedQuantity || 0) >= item.sellQuantity);
  }, [heldSale]);

  React.useEffect(() => {
    if (isOpen) {
      setIsPrinted(false);
    }
  }, [isOpen]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  if (!heldSale) return null;

  const heldAtDate = getSafeDate(heldSale.heldAt);
  const cartItems = heldSale.cart || [];
  const total = cartItems.reduce((sum, item) => sum + item.sellingPrice * Number(item.sellQuantity), 0);

  const handlePrint = () => {
    if (isPrinted || allItemsPrinted) return;

    const printContent = activeTab === 'invoice' ? invoiceRef.current : terminalRef.current;
    if (!printContent) return;

    const useIframe = !!settings?.posAllowPopups;
    printHtml(printContent.innerHTML, { title: 'Running Table Docket', useIframe });

    setIsPrinted(true);
    if (onPrinted) onPrinted();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Running Table Docket</DialogTitle>
          <DialogDescription>A draft receipt for the running table "{heldSale.name}".</DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="terminal">Terminal Docket</TabsTrigger>
            <TabsTrigger value="invoice">Professional Docket</TabsTrigger>
          </TabsList>
          <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
            <TabsContent value="terminal">
              <div ref={terminalRef} className="p-4 bg-white text-black receipt max-w-sm mx-auto text-sm">
                <div className="text-center space-y-1 mb-4">
                  {displayLogoUrl && (
                    <img
                      src={displayLogoUrl}
                      alt={displayName}
                      style={{ height: `${logoSize}px`, width: 'auto' }}
                      className="object-contain mx-auto"
                    />
                  )}
                  <h1 className="font-bold text-lg">{displayName}</h1>
                  {displayAddress && <p className="text-xs">{displayAddress}</p>}
                  {displayPhone && <p className="text-xs">Tel: {displayPhone}</p>}
                </div>
                <div className="text-center text-xs mb-4">
                  <p>Date: {heldAtDate ? format(heldAtDate, 'MM/dd/yyyy HH:mm:ss') : 'N/A'}</p>
                  <p>Started By: {heldSale.heldByName}</p>
                  <p>Customer: {heldSale.customer?.name || 'Walk-in Customer'}</p>
                </div>
                <p className="font-bold uppercase text-center mb-2">
                  DRAFT - RUNNING TABLE: {heldSale.name}
                </p>
                <div className="border-y border-dashed border-black py-2">
                  {cartItems.map((item, index) => (
                    <div key={index} className="border-b border-dashed border-gray-300 py-1 last:border-b-0">
                      <div className="flex justify-between">
                        <span>{item.name}</span>
                        <span>{formatCurrency(item.sellingPrice * Number(item.sellQuantity))}</span>
                      </div>
                      <div className="text-xs ml-2">
                        {item.sellQuantity} @ {formatCurrency(item.sellingPrice)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-bold text-base pt-2">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <div className="text-center text-xs mt-6">
                  <p>THIS IS NOT A FINAL RECEIPT</p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="invoice">
              <div ref={invoiceRef} className="p-8 bg-white text-black text-sm">
                <h2 className="font-bold text-2xl text-center mb-4">DRAFT ORDER</h2>
                <p><strong>Table Name:</strong> {heldSale.name}</p>
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
                    {cartItems.map((item, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="p-3">{item.name}</td>
                        <td className="p-3 text-center">{item.sellQuantity}</td>
                        <td className="p-3 text-right">{formatCurrency(item.sellingPrice)}</td>
                        <td className="p-3 text-right">{formatCurrency(item.sellingPrice * Number(item.sellQuantity))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end">
                  <div className="w-full max-w-xs space-y-2">
                    <div className="flex justify-between font-bold text-lg border-t-2 border-gray-300 pt-2">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
        <DialogFooter className="sm:justify-between flex-row pt-4">
          <Button variant="ghost" onClick={onClose}>
            <X className="mr-2 h-4 w-4" /> Close
          </Button>
          <Button onClick={handlePrint} disabled={isPrinted || allItemsPrinted}>
            {isPrinted || allItemsPrinted ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            {isPrinted || allItemsPrinted ? 'Printed' : 'Print'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
