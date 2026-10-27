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
import { Separator } from '@/components/ui/separator';
import type { Booking } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, Download, CircleX } from 'lucide-react';
import { Logo } from '../logo';
import { useSettings } from '@/contexts/settings-context';
import { getSafeDate } from '@/lib/helpers';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import Image from 'next/image';


interface CancellationInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
}

export function CancellationInvoiceDialog({
  isOpen,
  onClose,
  booking,
}: CancellationInvoiceDialogProps) {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState('invoice');
  const { settings } = useSettings();

  const currency = settings?.currency || 'USD';
  const logoSize = settings?.businessLogoSize || 48;
  const showWatermark = settings?.showWatermarkLogo;
  const watermarkUrl = settings?.watermarkLogoUrl;
  const watermarkOpacity = settings?.watermarkOpacity ?? 0.07;
  const watermarkSize = settings?.watermarkSize ?? 50;
  const watermarkPosition = settings?.watermarkPosition ?? 'center';
  const useHDPrinting = settings?.useHDPrinting ?? true;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };


  const handlePrint = () => {
    const printContent = activeTab === 'invoice' ? invoiceRef.current : terminalRef.current;

    if (printContent) {
      const printWindow = window.open('', '', 'height=800,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Print Document</title>');
        if (useHDPrinting) {
          printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
        }
        printWindow.document.write('<style>@media print { @page { margin: 0mm !important; } body { margin: 1cm !important; } @page { margin: 0mm !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } } .receipt { font-family: monospace; }</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(printContent.innerHTML);
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

  if (!booking) return null;

  const checkInDate = getSafeDate(booking?.checkInDate);
  const checkOutDate = getSafeDate(booking?.checkOutDate);
  const cancelledAtDate = getSafeDate(booking?.cancelledAt) || new Date();

  const wasActiveBooking = booking.status === 'Refunded' && booking.checkedInByUid;
  const wasPaid = !!booking.paymentMethod;
  const wasPrePaidReservation = wasPaid && !wasActiveBooking;

  const getCancellationTitle = () => {
    if (wasActiveBooking) return 'Booking Cancelled';
    if (wasPrePaidReservation) return 'Pre-paid Reservation Cancelled';
    return 'Reservation Cancelled';
  };

  const getCancellationDescription = () => {
     if (wasActiveBooking) return `This active booking has been cancelled. A refund of ${formatCurrency(booking.amount || 0)} will be processed.`;
     if (wasPrePaidReservation) return `A refund will be issued for the pre-paid amount of ${formatCurrency(booking.amount || 0)}.`;
    return 'This was an unpaid reservation. No refund is due.';
  };

  const getCancellationDetailsText = () => {
    if (wasActiveBooking) return settings?.cancellationMessageActive || "The guest's booking has been terminated, and a full refund has been processed.";
    if (wasPrePaidReservation) return settings?.cancellationMessagePrepaid || 'A refund for the pre-paid amount has been issued. The funds should appear in the original account within 5-10 business days.';
    return settings?.cancellationMessageUnpaid || 'This was an unpaid reservation; therefore, no refund is due.';
  }

  const footerLine1 = settings?.cancellationFooterLine1 || 'This is an official cancellation confirmation.';
  const footerLine2 = settings?.cancellationFooterLine2 || 'Hotel Suite Pro | This is a computer-generated document.';

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
          <DialogTitle>Cancellation Invoice</DialogTitle>
          <DialogDescription>
            A confirmation of the cancellation for your records.
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
                                    {settings?.businessLogoUrl ? (
                                        <Image src={settings.businessLogoUrl} alt={settings.businessName || 'logo'} width={logoSize} height={logoSize} className="object-contain" />
                                    ) : (
                                        <Logo className="h-10 w-10 text-slate-800" />
                                    )}
                                </div>
                                <div className="text-right">
                                    <h1 className="font-bold text-xl text-slate-800">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                                    <p className="text-slate-500 text-xs">{settings?.businessAddress}</p>
                                    <p className="text-slate-500 text-xs">{settings?.businessPhone}</p>
                                    <p className="text-slate-500 text-xs">{settings?.businessEmail}</p>
                                    <p className="text-slate-500 text-xs">{settings?.businessWebsite}</p>
                                </div>
                            </header>

                            <Separator className="my-4" />

                            <div className="text-center mb-6">
                                <h2 className="font-bold text-2xl uppercase text-red-600">Cancellation</h2>
                                <p className="text-slate-500 text-[11px]">Booking ID: {booking.id}</p>
                                <p className="text-slate-500 text-[11px]">Cancelled On: {cancelledAtDate ? format(cancelledAtDate, 'EEEE dd-MM-yyyy') : 'N/A'}</p>
                            </div>

                            <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4 mb-8">
                                <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                                    <div className="rounded-full bg-red-100 p-3">
                                        <CircleX className="h-8 w-8 text-red-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-red-700">{getCancellationTitle()}</h3>
                                        <p className="text-sm text-red-600/80">
                                            {getCancellationDescription()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8 mb-8">
                                <div>
                                    <h3 className="font-semibold text-slate-600 mb-1">Guest Information:</h3>
                                    <p className="font-bold text-slate-800">{booking.guestName}</p>
                                    <p className="text-slate-600">{booking.guestEmail}</p>
                                    <p className="text-slate-600">{booking.guestPhoneNumber}</p>
                                    {booking?.guestAddress && <p className="text-slate-600">{booking.guestAddress}</p>}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-600 mb-1">Booking Details:</h3>
                                    <p className="text-slate-800"><b>Room:</b> {booking.roomNumber}</p>
                                    <p className="text-slate-800"><b>Check-in:</b> {checkInDate ? format(checkInDate, 'EEEE dd-MM-yyyy') : 'N/A'}</p>
                                    <p className="text-slate-800"><b>Check-out:</b> {checkOutDate ? format(checkOutDate, 'EEEE dd-MM-yyyy') : 'N/A'}</p>
                                </div>
                            </div>

                            {(wasPaid) && (
                                <>
                                    <Separator className="my-8" />
                                    <div>
                                        <h3 className="font-semibold text-slate-600 mb-2">Financial Summary:</h3>
                                        <div className="w-full max-w-sm ml-auto space-y-3 text-slate-700">
                                            <div className="flex justify-between">
                                                <span>Original Amount Paid</span>
                                                <span>{formatCurrency(booking.amount || 0)}</span>
                                            </div>
                                            <div className="flex justify-between font-bold text-lg text-red-600 border-t-2 border-dashed border-slate-300 pt-3">
                                                <span>Refund Issued</span>
                                                <span>{formatCurrency(booking.amount || 0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}


                            <Separator className="my-8" />

                            <div>
                                <h3 className="font-semibold text-slate-600 mb-2">Cancellation Details:</h3>
                                <p className="text-slate-700">This booking was cancelled by <b>{booking.cancelledByName || 'System'}</b> on {cancelledAtDate ? format(cancelledAtDate, 'EEEE dd-MM-yyyy, p') : 'N/A'}.</p>
                                <p className="text-slate-700 mt-1">{getCancellationDetailsText()}</p>
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
                            {settings?.businessLogoUrl && (
                                <Image src={settings.businessLogoUrl} alt={settings.businessName || 'logo'} width={logoSize} height={logoSize} className="object-contain mx-auto" />
                            )}
                            <h1 className="font-bold text-lg">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                             <p className="text-xs">{settings?.businessAddress || '123 Luxury Lane, Suite 100, Metropolis, ST 12345'}</p>
                             <p className="text-xs">{settings?.businessPhone || 'contact@example.com'}</p>
                        </div>
                        <div className="text-center text-xs mb-4">
                            <p>Date: {cancelledAtDate ? format(cancelledAtDate, 'MM/dd/yyyy HH:mm:ss') : 'N/A'}</p>
                            <p>Booking ID: {booking.id}</p>
                        </div>
                        <div className="text-center font-bold text-lg uppercase border-y-2 border-dashed border-black my-4 py-2">
                            {getCancellationTitle()}
                        </div>
                        <div className="space-y-1 mb-4">
                            <div className="flex justify-between">
                                <span>Guest:</span>
                                <span>{booking.guestName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Room:</span>
                                <span>{booking.roomNumber}</span>
                            </div>
                             <div className="flex justify-between">
                                <span>Check-in:</span>
                                <span>{checkInDate ? format(checkInDate, 'MM/dd/yy') : 'N/A'}</span>
                            </div>
                        </div>
                        {wasPaid ? (
                            <div className="my-4 space-y-1 text-center font-bold border-y border-dashed border-black py-2">
                                <div className="flex justify-between text-lg text-red-600">
                                    <span>REFUND DUE:</span>
                                    <span>{formatCurrency(booking.amount || 0)}</span>
                                </div>
                                <div className="text-xs font-normal">
                                    <span>(Original Payment: {booking.paymentMethod})</span>
                                </div>
                            </div>
                        ) : (
                             <div className="my-4 space-y-1 text-center border-y border-dashed border-black py-2">
                                <p className="font-bold">NO REFUND DUE</p>
                                <p className="text-xs font-normal">(This was an unpaid reservation)</p>
                             </div>
                        )}
                         <div className="my-4 space-y-1 text-center">
                            <p>This document confirms the cancellation of the above booking.</p>
                             <p className="text-xs">Cancelled by: {booking.cancelledByName || 'System'}</p>
                        </div>
                        <div className="text-center text-xs mt-6">
                            <p>{footerLine1}</p>
                            <p>{footerLine2}</p>
                        </div>
                    </div>
                </TabsContent>
            </div>
        </Tabs>

        <DialogFooter className="sm:justify-between flex-row pt-4">
            <Button variant="ghost" onClick={onClose}>
                <X className="mr-2 h-4 w-4" /> Close
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button>
                        <Printer className="mr-2 h-4 w-4" /> Print / Download
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handlePrint}>
                        <Download className="mr-2 h-4 w-4" />
                        Download as PDF
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
