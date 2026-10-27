
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
import type { Booking } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, Download } from 'lucide-react';
import { Logo } from '../logo';
import { useSettings } from '@/contexts/settings-context';
import { getSafeDate } from '@/lib/helpers';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import Image from 'next/image';
import { Label } from '../ui/label';
import { Input } from '../ui/input';

interface UnpaidInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onBillItemReturned?: () => void;
}

const InvoiceContent = ({
  booking,
  totalCharges,
  settings,
  formatCurrency,
  logoSize,
}: {
  booking: Booking;
  totalCharges: number;
  settings: ReturnType<typeof useSettings>['settings'];
  formatCurrency: (amount: number) => string;
  logoSize: number;
}) => (
    <>
      <header className="flex justify-between items-start mb-8">
        <div>
          {settings?.businessLogoUrl ? (
            <img src={settings.businessLogoUrl} alt={settings.businessName || 'logo'} style={{ height: `${logoSize}px` }} />
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
          <h2 className="font-bold text-2xl uppercase text-slate-800">Reservation Invoice</h2>
          <p className="text-slate-500">Booking ID: {booking.id}</p>
          <p className="text-slate-500">Date: {format(new Date(), 'PP')}</p>
        </div>
        <div className="text-right">
          <h3 className="font-semibold text-slate-600 mb-1">Bill To:</h3>
          <p className="font-bold text-slate-800">{booking.guestName}</p>
          <p className="text-slate-600">{booking.guestEmail}</p>
        </div>
      </div>
      <table className="w-full text-left">
        <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
          <tr>
            <th className="p-3">Description</th>
            <th className="p-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <td className="p-3">Room Charge: {booking.roomNumber}</td>
            <td className="p-3 text-right">{formatCurrency(booking.totalAmount || 0)}</td>
          </tr>
        </tbody>
      </table>
      <div className="flex justify-end mt-8">
        <div className="w-full max-w-xs space-y-3 text-slate-700">
          <div className="flex justify-between font-bold text-lg text-red-600 border-t-2 border-dashed border-red-300 pt-3">
            <span>Amount Due</span>
            <span>{formatCurrency(totalCharges)}</span>
          </div>
        </div>
      </div>
      <div className="mt-12 text-center text-xs text-slate-500">
        <p>{settings?.unpaidInvoiceFooterLine1 || 'Thank you for choosing us! Payment is due upon check-in.'}</p>
        <p>{settings?.unpaidInvoiceFooterLine2 || 'This is a computer-generated document.'}</p>
      </div>
    </>
);

export function UnpaidInvoiceDialog({ isOpen, onClose, booking, onBillItemReturned }: UnpaidInvoiceDialogProps) {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState('invoice');
  const [printCopies, setPrintCopies] = React.useState(1);
  const { settings } = useSettings();

  if (!booking) return null;

  const currency = settings?.currency || 'USD';
  const logoSize = settings?.businessLogoSize || 48;
  const useHDPrinting = settings?.useHDPrinting ?? true;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  const handlePrint = (copies: number) => {
    const printContent = activeTab === 'invoice' ? invoiceRef.current : terminalRef.current;
    if (printContent) {
      const printWindow = window.open('', '', 'height=800,width=800');
      if (printWindow) {
        const tailwindScript = useHDPrinting ? '<script src="https://cdn.tailwindcss.com"></script>' : '';
        printWindow.document.write(`<html><head><title>Print Invoice</title>${tailwindScript}<style>@media print { @page { margin: 0mm !important; } body { margin: 1cm !important; } @page { margin: 0mm !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .receipt-copy { page-break-after: always; } .no-print { display: none !important; } } .receipt { font-family: monospace; }</style></head><body>`);

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

  const totalCharges = booking.totalAmount || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Unpaid Reservation Invoice</DialogTitle>
          <DialogDescription>
            This is an invoice for an unpaid reservation. Payment is due upon check-in.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invoice">Professional Invoice</TabsTrigger>
            <TabsTrigger value="terminal">Terminal Receipt</TabsTrigger>
          </TabsList>
          <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
            <TabsContent value="invoice">
               <div ref={invoiceRef} className="p-8 bg-white text-black text-sm rounded-lg">
                <InvoiceContent booking={booking} totalCharges={totalCharges} settings={settings} formatCurrency={formatCurrency} logoSize={logoSize} />
              </div>
            </TabsContent>
             <TabsContent value="terminal">
              <div ref={terminalRef} className="p-4 bg-white text-black receipt max-w-sm mx-auto text-sm">
                <div className="text-center space-y-1 mb-4">
                  {settings?.businessLogoUrl && <Image src={settings.businessLogoUrl} alt={settings.businessName || 'logo'} width={logoSize} height={logoSize} className="object-contain mx-auto" />}
                  <h1 className="font-bold text-lg">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                </div>
                <div className="text-center text-xs mb-4">
                  <p>Date: {format(new Date(), 'MM/dd/yyyy HH:mm:ss')}</p>
                  <p>Booking ID: {booking.id}</p>
                </div>
                <p className="font-bold uppercase text-center mb-2">Unpaid Reservation</p>
                <div className="space-y-1 border-t border-dashed border-black pt-2">
                  <div className="flex justify-between">
                    <span>Room Charge: {booking.roomNumber}</span>
                    <span>{formatCurrency(totalCharges)}</span>
                  </div>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-dashed border-black pt-2 mt-2">
                  <span>TOTAL DUE:</span>
                  <span>{formatCurrency(totalCharges)}</span>
                </div>
                <div className="text-center font-bold my-4 text-red-600">
                  *** PAYMENT DUE UPON CHECK-IN ***
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
