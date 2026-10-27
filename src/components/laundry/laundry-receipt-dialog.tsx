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
import type { LaundryOrder, Bill } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, Download } from 'lucide-react';
import { Logo } from '../logo';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { getSafeDate } from '@/lib/helpers';
import Image from 'next/image';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Input } from '../ui/input';


interface LaundryReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: LaundryOrder | null;
  allBills: Bill[];
}

export function LaundryReceiptDialog({ isOpen, onClose, order, allBills }: LaundryReceiptDialogProps) {
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
  const showWatermark = settings?.showWatermarkLogo;
  const watermarkUrl = settings?.watermarkLogoUrl;
  const watermarkOpacity = settings?.watermarkOpacity ?? 0.07;
  const watermarkSize = settings?.watermarkSize ?? 50;
  const watermarkPosition = settings?.watermarkPosition ?? 'center';
  const useHDPrinting = settings?.useHDPrinting ?? true;

  const billForItem = React.useMemo(() => {
    if (!order || !allBills) return null;
    return allBills.find(b => b.items.some(i => i.id.startsWith(`laundry-${order.orderNumber}`)));
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
      const printWindow = window.open('', '', 'height=800,width=800');
      if (printWindow) {
        const tailwindScript = useHDPrinting ? '<script src="https://cdn.tailwindcss.com"></script>' : '';
        printWindow.document.write(`<html><head><title>Print Document</title>${tailwindScript}<style>@media print { @page { margin: 0mm !important; } body { margin: 1cm !important; } @page { margin: 0mm !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .receipt-copy { page-break-after: always; } .no-print { display: none !important; } } .receipt { font-family: monospace; }</style></head><body>`);

        let contentToPrint = '';
        for (let i = 0; i < copies; i++) {
          contentToPrint += `<div class="receipt-copy">${printContent.innerHTML}</div>`;
        }
        printWindow.document.write(contentToPrint);

        printWindow.document.write('</body></html>');
        printWindow.document.close();

        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }
  };

  if (!order) return null;

  const createdAtDate = getSafeDate(order.createdAt);
  const footerLine1 = settings?.unpaidInvoiceFooterLine1 || 'Thank you for choosing Hotel Suite Pro!';
  const footerLine2 = settings?.unpaidInvoiceFooterLine2 || 'This is a computer-generated document.';

  const getWatermarkPositionStyle = () => {
    switch (watermarkPosition) {
      case 'top-left': return { top: '5%', left: '5%', transform: 'translate(0, 0)' };
      case 'top-right': return { top: '5%', right: '5%', transform: 'translate(0, 0)' };
      case 'bottom-left': return { bottom: '5%', left: '5%', transform: 'translate(0, 0)' };
      case 'bottom-right': return { bottom: '5%', right: '5%', transform: 'translate(0, 0)' };
      default: return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  const watermarkContainerStyle: React.CSSProperties = watermarkPosition === 'tile' ? {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${watermarkSize * 2}px, 1fr))`,
    gap: '20px',
    opacity: watermarkOpacity,
    zIndex: 0,
    pointerEvents: 'none',
  } : {
    position: 'absolute',
    opacity: watermarkOpacity,
    zIndex: 0,
    pointerEvents: 'none',
    width: `${watermarkSize}%`,
    height: 'auto',
    ...getWatermarkPositionStyle(),
  };

  const WatermarkComponent = () => {
    if (!showWatermark || !watermarkUrl) return null;

    if (watermarkPosition === 'tile') {
      return (
        <div style={watermarkContainerStyle}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="relative w-full aspect-square">
              <Image src={watermarkUrl} alt="Watermark" layout="fill" objectFit="contain" />
            </div>
          ))}
        </div>
      );
    }

    return (
       <div style={watermarkContainerStyle}>
            <div style={{ position: 'relative', width: '100%', paddingBottom: '100%' }}>
                <Image src={watermarkUrl} alt="Watermark" layout="fill" objectFit="contain" />
            </div>
        </div>
    );
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Laundry Order Receipt</DialogTitle>
          <DialogDescription>
            A receipt for the laundry order. Print this for your records or the guest.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="invoice">Professional Invoice</TabsTrigger>
                <TabsTrigger value="terminal">Terminal Receipt</TabsTrigger>
            </TabsList>

            <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
                <TabsContent value="invoice">
                    <div ref={invoiceRef} className="p-8 bg-white text-black text-sm rounded-lg relative">
                        <WatermarkComponent />
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <header className="flex justify-between items-start mb-8">
                                <div>
                                    {logoUrl ? (
                                        <Image src={logoUrl} alt={settings.businessName || 'logo'} width={logoSize} height={logoSize} className="object-contain" />
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
                                    <h2 className="font-bold text-2xl uppercase text-slate-800">Laundry Order</h2>
                                    <p className="text-slate-500">Order #: {order.orderNumber}</p>
                                    <p className="text-slate-500">Date: {createdAtDate ? format(createdAtDate, 'EEEE, PPP') : 'N/A'}</p>
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
                                        <th className="p-3 text-center">Quantity</th>
                                        <th className="p-3 text-right">Unit Price</th>
                                        <th className="p-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.items?.map((item, index) => (
                                        <tr key={`${item.name}-${index}`} className="border-b border-slate-100">
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
                                    {isPaid && (
                                        <div className="flex justify-between font-bold text-lg text-green-600 border-t-2 border-dashed border-green-300 pt-3">
                                            <span>Amount Paid</span>
                                            <span>{formatCurrency(order.totalPrice)}</span>
                                        </div>
                                    )}
                                    <p className="text-xs text-right text-slate-500">
                                        {isPaid ? 'This amount has been settled.' : 'This charge has been added to the room bill.'}
                                    </p>
                                </div>
                            </div>

                            <Separator className="my-6"/>

                            <div className="text-sm">
                                <p><b>Processed by:</b> {order.staffName || 'System'}</p>
                            </div>

                            <div className="mt-12 text-center text-xs text-slate-500">
                                <p>{footerLine1}</p>
                                <p>{footerLine2}</p>
                            </div>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="terminal">
                     <div ref={terminalRef} className="p-4 bg-white text-black receipt max-w-sm mx-auto text-sm">
                        <div className="text-center space-y-1 mb-4">
                            {logoUrl && (
                                <Image src={logoUrl} alt={settings.businessName || 'logo'} width={logoSize} height={logoSize} className="object-contain mx-auto" />
                            )}
                            <h1 className="font-bold text-lg">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                             <p className="text-xs">{settings?.businessAddress || '123 Luxury Lane, Suite 100, Metropolis, ST 12345'}</p>
                             <p className="text-xs">{settings?.businessPhone || 'contact@example.com'}</p>
                        </div>
                        <div className="text-center text-xs mb-4">
                            <p>Date: {createdAtDate ? format(createdAtDate, 'MM/dd/yyyy HH:mm:ss') : 'N/A'}</p>
                            <p>Order #: {order.orderNumber}</p>
                            {order.staffName && <p>Processed by: {order.staffName}</p>}
                        </div>

                        <div className="space-y-1 mb-2 border-y border-dashed border-black py-2">
                           <p className="uppercase font-bold text-xs">Guest Info</p>
                            <div className="flex justify-between">
                                <span>Guest:</span>
                                <span>{order.guestName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Room:</span>
                                <span>{order.roomNumber}</span>
                            </div>
                        </div>

                        <p className="font-bold uppercase mb-2">Laundry Items</p>
                        <div className="space-y-1 border-b border-dashed border-black pb-2">
                            {order.items?.map((item, index) => (
                                <div key={index}>
                                    <div className="flex justify-between">
                                        <span>{item.name}</span>
                                        <span>{formatCurrency(item.price * item.quantity)}</span>
                                    </div>
                                    <div className="text-xs ml-2">
                                        {item.quantity} @ {formatCurrency(item.price)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between font-bold text-base pt-2">
                            <span>TOTAL:</span>
                            <span>{formatCurrency(order.totalPrice)}</span>
                        </div>

                         <div className="my-4 space-y-1 text-center">
                            {isPaid ? (
                                <p className="font-bold text-lg text-green-600">PAID</p>
                            ) : (
                                <p>This charge has been added to your room bill.</p>
                            )}
                        </div>
                        <div className="text-center text-xs mt-6">
                            <p>{footerLine1}</p>
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
