
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
import type { Booking } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, Copy } from 'lucide-react';
import { Logo } from '../logo';
import { useSettings } from '@/contexts/settings-context';
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
  <section
    data-invoice-paper
    className="w-full max-w-7xl relative border border-gray-200 rounded-2xl p-6 sm:p-8 md:p-10 shadow-sm bg-white"
  >
    <div className="flex justify-between items-start gap-6">
      <div className="w-16 h-16 shrink-0 bg-neutral-950 rounded-sm flex items-center justify-center p-1.5 border border-neutral-700 shadow-inner">
        <div className="w-full h-full border border-amber-400/80 rounded-full flex items-center justify-center p-1">
          {settings?.businessLogoUrl ? (
            <img
              src={settings.businessLogoUrl}
              alt={settings.businessName || 'Business logo'}
              style={{ width: Math.min(logoSize, 48), height: Math.min(logoSize, 48), objectFit: 'contain' }}
            />
          ) : (
            <Logo className="h-8 w-8 text-amber-400" />
          )}
        </div>
      </div>
      <div className="min-w-0 text-right">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">
          {settings?.businessName || 'Hotel Suite Pro'}
        </h2>
        {settings?.businessRegistrationNumber && (
          <p className="text-xs text-gray-500 mt-1">{settings.businessRegistrationNumber}</p>
        )}
        <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-medium">
          {settings?.businessAddress || ''}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 font-medium">{settings?.businessPhone || ''}</p>
      </div>
    </div>

    <div className="mt-8 flex flex-col sm:flex-row justify-between items-start gap-6">
      <div>
        <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 uppercase">
          Reservation Invoice
        </h3>
        <p className="text-sm text-gray-500 mt-2">
          Booking ID: <span className="font-medium text-gray-700 break-all">{booking.id}</span>
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Date: <span className="font-medium text-gray-700">{format(new Date(), 'PP')}</span>
        </p>
      </div>
      <div className="text-left sm:text-right sm:pr-6">
        <span className="text-xs font-bold text-gray-800 uppercase block tracking-wider">Bill To:</span>
        <span className="text-base font-bold text-gray-900 block mt-0.5">{booking.guestName}</span>
        {booking.guestEmail && (
          <span className="text-sm text-gray-600 block mt-0.5 break-all">{booking.guestEmail}</span>
        )}
        {booking.guestPhoneNumber && (
          <span className="text-sm text-gray-600 block mt-0.5">{booking.guestPhoneNumber}</span>
        )}
      </div>
    </div>

    <div className="mt-8">
      <div className="bg-slate-100/90 py-2.5 px-4 rounded-sm flex justify-between items-center text-xs font-bold tracking-wider text-slate-700 uppercase">
        <span>Description</span>
        <span>Amount</span>
      </div>
      <div className="py-4 px-4 flex justify-between items-center gap-4 text-sm font-medium text-gray-800 border-b border-gray-100">
        <span>Room Charge: {booking.roomNumber}</span>
        <span className="font-semibold whitespace-nowrap">{formatCurrency(totalCharges)}</span>
      </div>
      <div className="mt-14 flex justify-end">
        <div className="w-full max-w-xs pt-3 border-t border-dashed border-red-300">
          <div className="flex justify-between items-center gap-4 text-red-600 font-bold text-base sm:text-lg">
            <span>Amount Due</span>
            <span className="whitespace-nowrap">{formatCurrency(totalCharges)}</span>
          </div>
        </div>
      </div>
    </div>

    {(settings?.unpaidInvoiceFooterLine1 || settings?.unpaidInvoiceFooterLine2) && (
      <div className="mt-10 text-center text-xs text-gray-500">
        {settings?.unpaidInvoiceFooterLine1 && <p>{settings.unpaidInvoiceFooterLine1}</p>}
        {settings?.unpaidInvoiceFooterLine2 && <p>{settings.unpaidInvoiceFooterLine2}</p>}
      </div>
    )}
  </section>
);

export function UnpaidInvoiceDialog({ isOpen, onClose, booking }: UnpaidInvoiceDialogProps) {
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
      <DialogContent className="receipt-dialog-fullscreen receipt-reference-dialog">
        <DialogHeader className="receipt-reference-header">
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold tracking-tight text-gray-900">
              Unpaid Reservation Invoice
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-gray-500">
              This is an invoice for an unpaid reservation. Payment is due upon check-in.
            </DialogDescription>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="receipt-reference-tabs">
          <TabsList className="receipt-reference-tab-list">
            <TabsTrigger value="invoice" className="receipt-reference-tab">
              Professional Invoice
            </TabsTrigger>
            <TabsTrigger value="terminal" className="receipt-reference-tab">
              Terminal Receipt
            </TabsTrigger>
          </TabsList>

          <div className="receipt-reference-main">
            <TabsContent value="invoice" className="receipt-reference-tab-panel">
              <div ref={invoiceRef} className="w-full flex justify-center">
                <InvoiceContent
                  booking={booking}
                  totalCharges={totalCharges}
                  settings={settings}
                  formatCurrency={formatCurrency}
                  logoSize={logoSize}
                />
              </div>
            </TabsContent>

            <TabsContent value="terminal" className="receipt-reference-tab-panel">
              <div
                ref={terminalRef}
                className="w-full max-w-sm mx-auto rounded-xl border border-gray-200 bg-white p-5 text-black text-sm shadow-sm"
              >
                <div className="text-center space-y-1 mb-4">
                  {settings?.businessLogoUrl && (
                    <Image
                      src={settings.businessLogoUrl}
                      alt={settings.businessName || 'logo'}
                      width={logoSize}
                      height={logoSize}
                      className="object-contain mx-auto"
                    />
                  )}
                  <h1 className="font-bold text-lg">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                  {settings?.businessAddress && <p className="text-xs">{settings.businessAddress}</p>}
                  {settings?.businessPhone && <p className="text-xs">{settings.businessPhone}</p>}
                </div>
                <div className="text-center text-xs mb-4">
                  <p>Date: {format(new Date(), 'MM/dd/yyyy HH:mm:ss')}</p>
                  <p>Booking ID: {booking.id}</p>
                </div>
                <p className="font-bold uppercase text-center mb-2">Unpaid Reservation</p>
                <div className="space-y-1 border-t border-dashed border-black pt-2">
                  <div className="flex justify-between gap-3">
                    <span>Room Charge: {booking.roomNumber}</span>
                    <span>{formatCurrency(totalCharges)}</span>
                  </div>
                </div>
                <div className="flex justify-between gap-3 font-bold text-base border-t border-dashed border-black pt-2 mt-2">
                  <span>Total Due:</span>
                  <span>{formatCurrency(totalCharges)}</span>
                </div>
                <div className="text-center font-bold my-4 text-red-600">
                  *** PAYMENT DUE UPON CHECK-IN ***
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="receipt-reference-footer">
          <Button variant="outline" onClick={onClose} className="receipt-reference-close modal-footer-close">
            <X className="mr-2 h-4 w-4" /> Close
          </Button>
          <div className="receipt-reference-actions">
            <div className="flex flex-col items-start">
              <Label htmlFor="print-copies" className="mb-1 text-[11px] font-medium leading-none text-gray-500">
                Copies
              </Label>
              <Input
                id="print-copies"
                type="number"
                min="1"
                value={printCopies}
                onChange={(e) => setPrintCopies(Math.max(1, Number(e.target.value) || 1))}
                className="h-10 w-20 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-gray-800 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
            <Button
              onClick={() => handlePrint(printCopies)}
              disabled={printCopies < 1}
              className="receipt-reference-print mt-3.5 inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
