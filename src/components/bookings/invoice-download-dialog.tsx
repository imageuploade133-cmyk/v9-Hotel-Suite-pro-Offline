'use client';

import * as React from 'react';
import { format, differenceInDays } from 'date-fns';
import { Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Booking, Bill, Payment, Settings } from '@/lib/types';

interface InvoiceDownloadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  bills: Bill[];
  payments: Payment[];
  currency: string;
  settings: Settings | null;
}

function getDate(date: any): Date {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (date.toDate && typeof date.toDate === 'function') return date.toDate();
  if (date.seconds) return new Date(date.seconds * 1000);
  return new Date(date);
}

export function InvoiceDownloadDialog({
  isOpen,
  onClose,
  booking,
  bills,
  payments,
  currency,
  settings,
}: InvoiceDownloadDialogProps) {
  const [isDownloading, setIsDownloading] = React.useState(false);
  const invoiceRef = React.useRef<HTMLDivElement>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const handleDownload = async () => {
    if (!invoiceRef.current || !booking) return;

    try {
      setIsDownloading(true);
      await document.fonts.ready;
      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `Invoice-${booking.guestName.replace(/\s+/g, '-')}-${format(new Date(), 'yyyyMMdd')}.png`;
      link.click();
    } catch (error) {
      console.error('Error generating invoice image:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!booking) return null;

  const totalRoomCharges = booking.totalAmount || 0;
  const totalBillCharges = bills.reduce((acc, bill) => acc + bill.total, 0);
  const totalCharges = totalRoomCharges + totalBillCharges;
  const totalPaid = payments.reduce((acc, payment) => acc + payment.amount, 0);
  const balanceDue = Math.max(0, totalCharges - totalPaid);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0 bg-background z-10">
          <DialogTitle>Invoice Preview</DialogTitle>
          <DialogDescription>
            Review the invoice details below. Click download to save as an image.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-slate-100/50 p-8 flex justify-center">
            <div
                ref={invoiceRef}
                className="bg-white text-slate-900 shadow-lg flex flex-col relative overflow-hidden shrink-0"
                style={{
                    width: '794px',
                    minHeight: '1123px',
                    padding: '48px',
                    boxSizing: 'border-box',
                    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
                }}
            >
                {settings?.businessLogoUrl && (
                    <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
                        <img src={settings.businessLogoUrl} alt="" className="w-[500px] h-[500px] object-contain grayscale" />
                    </div>
                )}

                <div className="relative z-10 flex-grow flex flex-col">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-12">
                        <div className="flex flex-col gap-4 max-w-[60%]">
                            {settings?.businessLogoUrl && (
                                <img src={settings.businessLogoUrl} alt="Logo" className="h-20 w-auto object-contain object-left" />
                            )}
                            <h1 className="text-2xl font-bold text-primary uppercase tracking-wide">{settings?.businessName || 'Hotel Name'}</h1>
                            <div className="text-sm text-slate-500 space-y-1">
                                {settings?.businessAddress && (
                                    <p className="whitespace-pre-line leading-relaxed">{settings.businessAddress}</p>
                                )}
                            </div>
                        </div>

                        <div className="text-right">
                            <h1 className="text-4xl font-light text-slate-900 mb-2 tracking-tight">INVOICE</h1>
                            <div className="space-y-1 text-sm">
                                <p><span className="text-slate-500 mr-4">Invoice #</span> <span className="font-medium font-mono">{booking.id.slice(0, 8).toUpperCase()}</span></p>
                                <p><span className="text-slate-500 mr-4">Date</span> <span className="font-medium">{format(new Date(), 'MMM dd, yyyy')}</span></p>
                                <p className="mt-2">
                                    <span className={cn(
                                        "inline-block px-3 py-1 rounded text-xs font-bold tracking-wider border",
                                        balanceDue <= 0
                                            ? "border-green-200 bg-green-50 text-green-700"
                                            : "border-red-200 bg-red-50 text-red-700"
                                    )}>
                                        {balanceDue <= 0 ? 'PAID' : 'PAYMENT DUE'}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <Separator className="my-8 bg-slate-200" />

                    <div className="grid grid-cols-2 gap-12 mb-12">
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Bill To</h3>
                            <div className="text-sm space-y-1.5">
                                <p className="font-semibold text-slate-900 text-lg">{booking.guestName}</p>
                                <p className="text-slate-600">{booking.guestEmail}</p>
                                {booking.guestPhoneNumber && <p className="text-slate-600">{booking.guestPhoneNumber}</p>}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Stay Details</h3>
                            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                                <div>
                                    <p className="text-slate-500 text-xs uppercase">Check-in</p>
                                    <p className="font-medium">{booking.checkInDate ? format(getDate(booking.checkInDate), 'MMM dd, yyyy') : '-'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs uppercase">Check-out</p>
                                    <p className="font-medium">{booking.checkOutDate ? format(getDate(booking.checkOutDate), 'MMM dd, yyyy') : '-'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs uppercase">Room</p>
                                    <p className="font-medium">{booking.roomNumber}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs uppercase">Guests</p>
                                    <p className="font-medium">{booking.guests || 1}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mb-8 flex-1">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-slate-900">
                                    <th className="text-left py-3 font-bold text-slate-900">Description</th>
                                    <th className="text-right py-3 font-bold text-slate-900 w-40">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <tr>
                                    <td className="py-4">
                                        <p className="font-medium text-slate-900">Room Charge</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Room {booking.roomNumber} &mdash; {differenceInDays(getDate(booking.checkOutDate || new Date()), getDate(booking.checkInDate || new Date()))} Night(s)
                                        </p>
                                    </td>
                                    <td className="text-right py-4 font-medium">{formatCurrency(totalRoomCharges)}</td>
                                </tr>
                                {bills.map((bill) => (
                                    <tr key={bill.id}>
                                        <td className="py-4">
                                            {bill.items.length > 0 ? (
                                                <div className="space-y-1">
                                                    {bill.items.map((item, idx) => (
                                                        <div key={idx} className="font-medium text-slate-900">
                                                            {item.description} {item.quantity > 1 && <span className="text-slate-500 font-normal text-sm">× {item.quantity}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="font-medium text-slate-900">Additional Services</p>
                                            )}
                                            <div className="text-xs text-slate-500 mt-1 opacity-75">
                                                Date: {format(getDate(bill.createdAt), 'MMM dd, yyyy')}
                                            </div>
                                        </td>
                                        <td className="text-right py-4 font-medium align-top">{formatCurrency(bill.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-auto">
                        <div className="flex justify-end border-t border-slate-900 pt-6">
                            <div className="w-72 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Subtotal</span>
                                    <span className="font-medium">{formatCurrency(totalCharges)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Amount Paid</span>
                                    <span className="font-medium text-green-600">-{formatCurrency(totalPaid)}</span>
                                </div>
                                <div className="border-t border-slate-200 my-2"></div>
                                <div className={cn(
                                    "flex justify-between items-baseline p-3 rounded-lg transition-colors",
                                    balanceDue > 0 && "border-2 border-red-500 bg-red-50"
                                )}>
                                    <span className={cn("font-bold text-lg", balanceDue > 0 ? "text-red-900" : "text-slate-900")}>Balance Due</span>
                                    <span className={cn("font-bold text-2xl", balanceDue > 0 ? "text-red-600" : "text-slate-900")}>{formatCurrency(balanceDue)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-16 pt-8 border-t border-slate-100 text-center text-slate-500 text-sm">
                            <p className="font-medium text-slate-900">Thank you for staying with us!</p>
                            <p className="text-xs mt-1">For any inquiries, please contact us.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <DialogFooter className="p-4 border-t bg-white shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}