
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
import type { Order, Bill } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, Download } from 'lucide-react';
import { Logo } from '../logo';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { getSafeDate } from '@/lib/helpers';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';


interface KitchenOrderReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  allBills?: Bill[];
}

export function KitchenOrderReceiptDialog({
  isOpen,
  onClose,
  order,
  allBills,
}: KitchenOrderReceiptDialogProps) {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState('terminal'); // Default to terminal for kitchen
  const [printCopies, setPrintCopies] = React.useState(1);
  const { settings } = useSettings();
  const { currentBranch } = useBranch();

  const currency = settings?.currency || 'USD';
  const logoSize = settings?.businessLogoSize || 48;
  // Use branch logo if available, otherwise fall back to settings logo
  const logoUrl = currentBranch?.logoUrl || settings?.businessLogoUrl;
  const useHDPrinting = settings?.useHDPrinting ?? true;

  const billForItem = React.useMemo(() => {
    if (!order || !allBills) return null;
    return allBills.find(b => b.items.some(i => i.id.startsWith(`order-${order.orderNumber}`)));
  }, [order, allBills]);

  const isPaid = billForItem?.paid ?? false;

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
        printWindow.document.write(`<html><head><title>Print Kitchen Order</title>${tailwindScript}<style>@media print { @page { margin: 0mm !important; } body { margin: 1cm !important; } @page { margin: 0mm !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .receipt-copy { page-break-after: always; } .no-print { display: none !important; } } .receipt { font-family: monospace; }</style></head><body>`);
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

  if (!order) return null;

  const createdAtDate = getSafeDate(order.createdAt);
  const footerLine1 = settings?.unpaidInvoiceFooterLine1 || 'Thank you!';
  const footerLine2 = settings?.unpaidInvoiceFooterLine2 || 'This is a computer-generated document.';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Kitchen Order #{order.orderNumber}</DialogTitle>
          <DialogDescription>
            A receipt for the kitchen to prepare and track the order.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="terminal">Terminal Docket</TabsTrigger>
                <TabsTrigger value="invoice">Professional Receipt</TabsTrigger>
            </TabsList>
            <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
                <TabsContent value="terminal">
                    <div ref={terminalRef} className="p-4 bg-white text-black receipt max-w-sm mx-auto text-sm">
                        <div className="text-center space-y-1 mb-4">
                        {logoUrl && (
                            <Image src={logoUrl} alt={settings.businessName || 'logo'} width={logoSize} height={logoSize} className="object-contain mx-auto" />
                        )}
                        <h1 className="font-bold text-lg">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                        <p className="font-bold text-xl uppercase">KITCHEN ORDER</p>
                        </div>

                        <Separator className="my-2 border-dashed border-black"/>

                        <div className="text-xs mb-2 space-y-0.5">
                            <div className="flex justify-between">
                                <span>Order #:</span>
                                <span className="font-bold">{order.orderNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Room:</span>
                                <span className="font-bold text-lg">Room {order.roomNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Date:</span>
                                <span>{createdAtDate ? format(createdAtDate, 'MM/dd/yyyy HH:mm') : 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Source:</span>
                                <span className="font-bold">{order.source === 'guest' ? 'Guest App' : 'Staff'}</span>
                            </div>
                        </div>

                        <Separator className="my-2 border-dashed border-black"/>

                        <div className="my-2">
                            <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 font-bold text-xs">
                                <span className="col-span-3">ITEM</span>
                            </div>
                            <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 font-bold text-xs">
                                <span className="col-span-1"></span>
                                <span className="text-center">QTY</span>
                                <span className="text-right">PRICE</span>
                            </div>

                            {order.items.map((item, index) => (
                                <div key={`${item.id}-${index}`} className="grid grid-cols-[1fr_auto_auto] gap-x-2 text-xs">
                                    <span className="truncate">{item.name}</span>
                                    <span className="text-center font-semibold">{item.quantity}</span>
                                    <span className="text-right">{formatCurrency(item.price * item.quantity)}</span>
                                </div>
                            ))}
                        </div>

                        <Separator className="my-2 border-dashed border-black"/>

                        <div className="text-right font-bold text-lg">
                            TOTAL: {formatCurrency(order.totalPrice)}
                        </div>

                        <div className="text-center text-xs mt-4">
                            <p>This is a computer-generated document.</p>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="invoice">
                    <div ref={invoiceRef} className="p-8 bg-white text-black text-sm rounded-lg">
                         <header className="flex justify-between items-start mb-8">
                            <div>
                                {logoUrl ? (
                                    <img src={logoUrl} alt={settings.businessName || 'logo'} style={{ height: `${logoSize}px` }} />
                                ) : (
                                    <Logo className="h-10 w-10 text-slate-800" />
                                )}
                            </div>
                            <div className="text-right">
                                <h1 className="font-bold text-xl text-slate-800">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                                <p className="text-slate-500 text-xs">{settings?.businessAddress}</p>
                                <p className="text-slate-500 text-xs">{settings?.businessPhone}</p>
                            </div>
                        </header>
                         <Separator className="my-4" />
                         <div className="flex justify-between items-center mb-8">
                            <div className="text-left">
                                <h2 className="font-bold text-2xl uppercase text-slate-800">Order Receipt</h2>
                                <p className="text-slate-500">Order #: {order.orderNumber}</p>
                                <p className="text-slate-500">Date: {createdAtDate ? format(createdAtDate, 'PPpp') : 'N/A'}</p>
                            </div>
                            <div className="text-right">
                                <h3 className="font-semibold text-slate-600 mb-1">Bill To:</h3>
                                <p className="font-bold text-slate-800">{order.guestName}</p>
                                <p className="text-slate-600">Room: {order.roomNumber}</p>
                            </div>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                                <tr>
                                    <th className="p-3">Item</th>
                                    <th className="p-3 text-center">Qty</th>
                                    <th className="p-3 text-right">Unit Price</th>
                                    <th className="p-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item, index) => (
                                    <tr key={`${item.id}-${index}`} className="border-b border-slate-100">
                                        <td className="p-3">{item.name}</td>
                                        <td className="p-3 text-center">{item.quantity}</td>
                                        <td className="p-3 text-right">{formatCurrency(item.price)}</td>
                                        <td className="p-3 text-right">{formatCurrency(item.price * item.quantity)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="flex justify-end mt-8">
                            <div className="w-full max-w-sm space-y-3 text-slate-700">
                                <div className="flex justify-between font-bold text-lg text-slate-800 border-t-2 border-dashed border-slate-300 pt-3">
                                    <span>Grand Total</span>
                                    <span>{formatCurrency(order.totalPrice)}</span>
                                </div>
                                <p className="text-xs text-right text-slate-500">
                                    {isPaid ? 'This amount has been settled.' : 'This charge has been added to the room bill.'}
                                </p>
                            </div>
                        </div>
                         <div className="mt-12 text-center text-xs text-slate-500">
                            <p>{footerLine1}</p>
                            <p>{footerLine2}</p>
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
