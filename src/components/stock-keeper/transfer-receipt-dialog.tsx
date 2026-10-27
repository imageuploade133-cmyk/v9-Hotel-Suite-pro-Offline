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
import type { TransferReceiptData } from '@/app/(protected)/stock-keeper/page';
import { format } from 'date-fns';
import { Printer, X, Download } from 'lucide-react';
import { Logo } from '../logo';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import Image from 'next/image';
import { Label } from '../ui/label';
import { Input } from '../ui/input';

interface TransferReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: TransferReceiptData | null;
}

export function TransferReceiptDialog({
  isOpen,
  onClose,
  receiptData,
}: TransferReceiptDialogProps) {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState('invoice');
  const [printCopies, setPrintCopies] = React.useState(1);
  const { settings } = useSettings();
  const { currentBranch } = useBranch();

  const currency = settings?.currency || 'USD';
  const logoSize = settings?.businessLogoSize || 48;
  // Use branch logo if available, otherwise fall back to settings logo
  const logoUrl = currentBranch?.logoUrl || settings?.businessLogoUrl;
  const useHDPrinting = settings?.useHDPrinting ?? true;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handlePrint = (copies: number) => {
    const printContent = activeTab === 'invoice' ? invoiceRef.current : terminalRef.current;
    if (printContent) {
      document.body.classList.add('print-container');

      let contentToPrint = '';
      for (let i = 0; i < copies; i++) {
        contentToPrint += `<div class="receipt-copy">${printContent.innerHTML}</div>`;
      }

      const printWindow = window.open('', '', 'height=800,width=800');
      if (printWindow) {
        const tailwindScript = useHDPrinting ? '<script src="https://cdn.tailwindcss.com"></script>' : '';
        printWindow.document.write(`<html><head><title>Print Transfer Receipt</title>${tailwindScript}<style>@media print { @page { margin: 0mm !important; } body { margin: 1cm !important; } @page { margin: 0mm !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .receipt-copy { page-break-after: always; } .no-print { display: none !important; } } .receipt { font-family: monospace; }</style></head><body>`);
        printWindow.document.write(contentToPrint);
        printWindow.document.write('</body></html>');
        printWindow.document.close();

        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }, 250);
      }

      document.body.classList.remove('print-container');
    }
  };

  if (!receiptData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Stock Transfer Receipt</DialogTitle>
          <DialogDescription>
            A receipt for the items transferred to the main inventory.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invoice">Professional Invoice</TabsTrigger>
            <TabsTrigger value="terminal">Terminal Receipt</TabsTrigger>
          </TabsList>

          <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
            <TabsContent value="invoice">
              <div ref={invoiceRef} className="p-8 bg-white text-black text-sm">
                <header className="flex justify-between items-start mb-8">
                  <div>
                    {logoUrl ? (
                      <img src={logoUrl} alt={settings.businessName || 'logo'} style={{ height: `${logoSize}px` }} />
                    ) : (
                      <Logo className="h-10 w-10 text-slate-800" />
                    )}
                  </div>
                  <div className="text-right">
                    <h1 className="font-bold text-lg text-slate-800">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                    <h2 className="font-semibold text-base">Stock Transfer / Invoice</h2>
                  </div>
                </header>
                <Separator className="my-4" />
                <div className="flex justify-between items-center mb-6">
                  <div className="text-left">
                    <p><b>Transfer ID:</b> {receiptData.id.substring(0, 8)}</p>
                    <p><b>Date:</b> {format(receiptData.transferredAt, 'PPpp')}</p>
                    <p><b>Supplier:</b> {receiptData.supplier || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p><b>Processed by:</b> {receiptData.transferredBy}</p>
                    <p><b>Invoice #:</b> {receiptData.invoiceNumber || 'N/A'}</p>
                  </div>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                    <tr>
                      <th className="p-2">Item</th>
                      <th className="p-2 text-center">Quantity</th>
                      <th className="p-2 text-right">Cost Price</th>
                      <th className="p-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptData.items.map((item, index) => (
                      <tr key={index} className="border-b border-slate-100">
                        <td className="p-2">{item.name}</td>
                        <td className="p-2 text-center">{item.quantity}</td>
                        <td className="p-2 text-right">{formatCurrency(item.costPrice)}</td>
                        <td className="p-2 text-right">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end mt-6">
                  <div className="w-full max-w-sm space-y-2 text-slate-700">
                    <div className="flex justify-between font-bold text-base border-t-2 border-dashed border-slate-300 pt-2">
                      <span>Total Value (Cost)</span>
                      <span>{formatCurrency(receiptData.totalValue)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="terminal">
               <div ref={terminalRef} className="p-4 bg-white text-black receipt max-w-sm mx-auto text-sm">
                    <div className="text-center space-y-1 mb-4">
                        {logoUrl && (
                            <img src={logoUrl} alt={settings.businessName || 'logo'} style={{ height: `${logoSize}px` }} className="mx-auto" />
                        )}
                        <h1 className="font-bold text-lg">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                    </div>
                    <div className="text-center text-xs mb-4">
                        <p>Date: {format(receiptData.transferredAt, 'MM/dd/yyyy HH:mm:ss')}</p>
                        <p>Transfer ID: {receiptData.id.substring(0, 8)}</p>
                        <p>Processed By: {receiptData.transferredBy}</p>
                    </div>
                    <div className="text-center text-xs mb-4">
                        <p>Supplier: {receiptData.supplier || 'N/A'}</p>
                        <p>Invoice #: {receiptData.invoiceNumber || 'N/A'}</p>
                    </div>
                    <p className="font-bold uppercase text-center mb-2">Stock Transfer</p>
                    <div className="space-y-1 border-y border-dashed border-black py-2">
                        {receiptData.items.map((item, index) => (
                            <div key={index}>
                                <div className="flex justify-between">
                                    <span>{item.name}</span>
                                    <span>{formatCurrency(item.subtotal)}</span>
                                </div>
                                <div className="text-xs ml-2">
                                    {item.quantity} @ {formatCurrency(item.costPrice)}
                                </div>
                            </div>
                        ))}
                    </div>
                     <div className="flex justify-between font-bold text-base pt-2">
                        <span>TOTAL COST:</span>
                        <span>{formatCurrency(receiptData.totalValue)}</span>
                    </div>
                     <div className="text-center text-xs mt-6">
                        <p>Items transferred to main inventory.</p>
                    </div>
               </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="sm:justify-between flex-row pt-4">
          <Button variant="ghost" onClick={onClose}><X className="mr-2 h-4 w-4" /> Close</Button>
          <div className="flex items-center gap-2">
            <div className="relative w-24">
              <Label htmlFor="print-copies" className="absolute -top-5 text-xs">Copies</Label>
              <Input
                id="print-copies"
                type="number"
                min="1"
                value={printCopies}
                onChange={(e) => setPrintCopies(Number(e.target.value))}
                className="h-9"
              />
            </div>
            <Button onClick={() => handlePrint(printCopies)} disabled={printCopies < 1}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
