
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { Booking, Bill, Payment, StockReturn, BillItem } from '@/lib/types';
import { Receipt, CreditCard, Undo2, LogIn, LogOut, Phone, Mail, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSafeDate, getCheckoutDateTime } from '@/lib/helpers';
import { format } from 'date-fns';
import { useSettings } from '@/contexts/settings-context';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { usePermissions } from '@/hooks/use-permissions';
import { PagePermission } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { getInitials } from '@/lib/helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '../logo';


interface Charge {
    id: string;
    date: Date;
    description: string;
    charge: number;
    status: 'Paid' | 'Unpaid';
    originalItem: any;
    originalBill?: Bill;
}

interface PaymentTransaction {
    id: string;
    date: Date;
    description: string;
    payment: number;
    status?: 'Paid' | 'Refunded' | 'Pending';
}

interface GuestFolioProps {
  booking: Booking;
  allBills: Bill[] | null;
  allPayments: Payment[] | null;
  allReturns: StockReturn[] | null;
  onBack?: () => void;
  onReturnItem?: (bill: Bill, item: BillItem) => void;
  onViewImage?: (url: string) => void;
  readOnly?: boolean;
  billsPrinted?: boolean;
}

const ChargeRow = ({ charge, formatCurrency, onReturnItem, readOnly, billsPrinted }: { charge: Charge, formatCurrency: (amount: number) => string, onReturnItem?: (bill: Bill, item: BillItem) => void, readOnly?: boolean, billsPrinted?: boolean }) => {
    const { hasPermission } = usePermissions();
    const { toast } = useToast();
    const canRefund = hasPermission(PagePermission.PROCESS_SALE_REFUNDS);
    const hasRolesPermission = hasPermission(PagePermission.MANAGE_ROLES);

    // Check if item/bill has been printed
    const item = charge.originalItem as BillItem | undefined;
    const bill = charge.originalBill;

    // Calculate printed quantity and returnable quantity
    const printedQuantity = item?.printedQuantity || 0;
    const itemQuantity = item?.quantity || 0;
    const returnableQuantity = Math.max(0, itemQuantity - printedQuantity);
    const isItemFullyPrinted = printedQuantity >= itemQuantity;
    const isBillPrinted = bill?.printStatus === 'printed' || billsPrinted;
    const hasPrintedItems = printedQuantity > 0;

    // Item can only be returned if it has returnable quantity and bill is not fully printed
    const canReturn = (canRefund || hasRolesPermission) &&
                      charge.originalBill &&
                      charge.originalItem &&
                      !isItemFullyPrinted &&
                      !isBillPrinted &&
                      !billsPrinted &&
                      returnableQuantity > 0;

    const handleReturnClick = () => {
        if (!canRefund && !hasRolesPermission) {
            toast({
                variant: 'destructive',
                title: 'Permission Denied',
                description: "You don't have permission to process refunds.",
            });
            return;
        }

        if (billsPrinted || isBillPrinted) {
            toast({
                variant: 'destructive',
                title: 'Cannot Return',
                description: "This bill has been printed and cannot be modified.",
            });
            return;
        }

        if (isItemFullyPrinted) {
            toast({
                variant: 'destructive',
                title: 'Cannot Return',
                description: `${printedQuantity} item(s) have been printed and cannot be returned.`,
            });
            return;
        }

        if (charge.originalBill && charge.originalItem && onReturnItem) {
            onReturnItem(charge.originalBill, charge.originalItem);
        }
    };

    return (
        <tr className="border-b last:border-b-0">
            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap align-top print:px-2 print:py-1">
                <span className="print:hidden">{format(charge.date, 'PPp')}</span>
                <span className="hidden print:inline">{format(charge.date, 'PP')}</span>
            </td>
            <td className="px-4 py-3 align-top print:px-2 print:py-1">
                <p className="font-medium text-sm print:text-xs">
                    {charge.description}
                </p>
                {(hasPrintedItems || isBillPrinted || billsPrinted) && (
                    <div className="flex flex-wrap gap-1 mt-1">
                        {(isBillPrinted || billsPrinted) && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                Docket Printed
                            </Badge>
                        )}
                        {hasPrintedItems && !isItemFullyPrinted && !billsPrinted && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                {printedQuantity} of {itemQuantity} printed
                            </Badge>
                        )}
                        {isItemFullyPrinted && !isBillPrinted && !billsPrinted && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                All items printed
                            </Badge>
                        )}
                    </div>
                )}
            </td>
            <td className="px-4 py-3 text-right font-semibold text-sm align-top print:px-2 print:py-1">
                {formatCurrency(charge.charge)}
            </td>
            <td className="px-4 py-3 text-center align-top print:px-2 print:py-1">
                <Badge variant={charge.status === 'Paid' ? 'success' : 'warning'} className="print:text-[10px] print:px-1 print:py-0">{charge.status}</Badge>
            </td>
            {!readOnly && (
                <td className="px-4 py-3 text-right align-top print:hidden">
                    {charge.originalBill && charge.originalItem && hasRolesPermission && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={handleReturnClick}
                            disabled={!canReturn}
                            title={isBillPrinted
                                ? "Bill has been printed - cannot return"
                                : isItemFullyPrinted
                                    ? "Item has been printed - cannot return"
                                    : !canRefund
                                        ? "No permission to return items"
                                        : "Return this item"
                            }
                        >
                             <Undo2 className="mr-2 h-4 w-4" />
                             Return
                        </Button>
                    )}
                </td>
            )}
        </tr>
    );
};

export const GuestFolio: React.FC<GuestFolioProps> = ({ booking, allBills, allPayments, allReturns, onBack, onReturnItem, onViewImage, readOnly = false, billsPrinted = false }) => {
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const checkoutTime = settings?.checkoutTime || '11:00';
  const [logoError, setLogoError] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  const { allCharges, allPaymentTransactions, totalCharges, totalPayments, balance, totalUnpaid } = React.useMemo(() => {
  if (!booking) return { allCharges: [], allPaymentTransactions: [], totalCharges: 0, totalPayments: 0, balance: 0, totalUnpaid: 0 };

  let charges: Charge[] = [];
  let paymentTransactions: PaymentTransaction[] = [];

  const createdAt = getSafeDate(booking.createdAt);

  // Check if guest is checked-in (Active or Checked-in status)
  const isCheckedIn = booking.status === 'Active' || booking.status === 'Checked-in';

  // Only show room transaction (room charge) - this is main room booking fee
  // Room charge is always marked as Paid per business logic
  if (booking.totalAmount && booking.totalAmount > 0 && createdAt) {
      charges.push({
          id: `booking-${booking.id}`,
          date: createdAt,
          description: `Room Charge - Room ${booking.roomNumber}`,
          charge: booking.totalAmount,
          status: 'Paid' as const, // Room charge is always Paid
          originalItem: booking,
      });
  }

    // Only show bills that are room bills (not other service bills like food, laundry, etc.)
    // Room bills typically have a specific structure - we filter to only include room-related charges
    const bookingBills = (allBills || []).filter(bill => (bill as any).bookingId === booking.id);
    bookingBills.forEach(bill => {
        const billDate = getSafeDate(bill.createdAt);
        if (billDate) {
            bill.items.forEach((item, index) => {
                // Only include charges that are related to the room (not other services)
                // We check if the item is marked as a room charge or if it's from a room bill
                const staffName = bill.createdByName || 'Unknown';
                charges.push({
                    id: `${bill.id}-${item.id}-${index}`,
                    date: billDate,
                    description: `${item.name} (x${item.quantity}) - by ${staffName}`,
                    charge: item.price * item.quantity,
                    status: 'Unpaid' as const, // Initially mark as Unpaid
                    originalItem: item,
                    originalBill: bill,
                });
            });
        }
    });

    charges.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Filter payments to show this booking's payments
    // Include all payments linked to this booking that are paid (not refunded)
    const bookingPayments = (allPayments || []).filter(p => {
        // Check if payment is for this booking
        const isSameBooking = p.bookingId === booking.id;
        if (!isSameBooking) return false;

        // Include paid status payments only
        if (p.status === 'Paid') return true;

        // Also include legacy payment types for backwards compatibility
        if (p.type === 'Booking' || p.type === 'Additional Charges') return true;

        return false;
    });

    // Add room charge as a paid transaction (room charge is always paid per business logic)
    if (booking.totalAmount && booking.totalAmount > 0 && createdAt) {
        paymentTransactions.push({
            id: `room-payment-${booking.id}`,
            date: createdAt,
            description: `Room Charge (Paid) - Room ${booking.roomNumber}`,
            payment: booking.totalAmount,
            status: 'Paid'
        });
    }

    bookingPayments.forEach(p => {
        const paymentDate = getSafeDate(p.transactionDate);
        if (paymentDate) {
            const description = p.type === 'Booking'
                ? `Room Payment (${p.paymentMethod || 'N/A'})`
                : `${p.paymentMethod || 'Additional Charge'} (${p.type || 'Payment'})`;
            paymentTransactions.push({
                id: `payment-${p.id}`,
                date: paymentDate,
                description,
                payment: p.amount,
                status: p.status
            });
        }
    });

    const bookingReturns = (allReturns || []).filter(r => (r as any).bookingId === booking.id);
    bookingReturns.forEach(r => {
        const returnedAt = getSafeDate(r.returnedAt);
        if (returnedAt) {
            paymentTransactions.push({ id: `return-${r.id}`, date: returnedAt, description: `Refund for ${r.items.map(i => i.itemName).join(', ')}`, payment: -r.totalRefundAmount });
        }
    });

    paymentTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Separate positive payments from refunds
    // positivePayments now includes the room charge (which is always paid) + any additional payments
    const positivePayments = paymentTransactions.filter(p => p.payment > 0).reduce((sum, t) => sum + t.payment, 0);
    const totalRefunds = paymentTransactions.filter(p => p.payment < 0).reduce((sum, t) => sum + Math.abs(t.payment), 0);

    // Total Payments = room charge (always paid) + additional payments
    // The positivePayments already includes the room charge from the payment transaction we added
    const calculatedTotalPayments = positivePayments; // Includes room charge + other payments, excludes refunds

    // Room charge is always Paid, so skip it in payment allocation
    // Calculate remaining payments after accounting for room charge
    const roomChargeAmount = booking.totalAmount || 0;
    let remainingPayments = positivePayments - roomChargeAmount;

    const finalCharges = charges.map(charge => {
        // Room charge is always Paid - don't deduct payments from it
        if (charge.id === `booking-${booking.id}`) {
            return { ...charge, status: 'Paid' as const };
        }

        // For additional bills, check if there are enough remaining payments to cover them
        if (remainingPayments >= charge.charge) {
            remainingPayments -= charge.charge;
            return { ...charge, status: 'Paid' as const };
        }
        // Otherwise, it's Unpaid
        return charge;
    });

    const calculatedTotalCharges = charges.reduce((sum, t) => sum + t.charge, 0);

    // Balance = Only unpaid additional bills (room charge is always Paid)
    // Since room charge is always Paid, balance only includes unpaid additional charges
    const calculatedBalance = finalCharges
        .filter(c => c.id !== `booking-${booking.id}` && c.status === 'Unpaid')
        .reduce((sum, c) => sum + c.charge, 0);

    const calculatedTotalUnpaid = finalCharges.filter(c => c.status === 'Unpaid').reduce((sum, c) => sum + c.charge, 0);

    return { allCharges: finalCharges, allPaymentTransactions: paymentTransactions, totalCharges: calculatedTotalCharges, totalPayments: calculatedTotalPayments, balance: calculatedBalance, totalUnpaid: calculatedTotalUnpaid };
  }, [booking, allBills, allPayments, allReturns, readOnly]);

  const checkIn = getSafeDate(booking.checkInDate);
  const checkOut = getSafeDate(booking.checkOutDate);
  const scheduledCheckoutDate = checkOut ? getCheckoutDateTime(checkOut, checkoutTime) : null;

  const logoSize = settings?.businessLogoSize || 48;
  const businessName = settings?.businessName || 'Your Business';
  const hasBusinessLogo = settings?.businessLogoUrl && !logoError;

  return (
    <div className="flex-1 overflow-y-auto space-y-6 p-1 print:overflow-visible">
        <header className={`bg-background rounded-lg p-6 mb-6 text-center border shadow-sm print:shadow-none print:rounded-none print:mb-3 print:p-3 print:border print:break-inside-avoid ${readOnly ? '' : 'hidden print:block'}`}>
                <div className="flex justify-center items-center mb-4 print:mb-2">
                    {hasBusinessLogo ? (
                        <div className="relative print:hidden" style={{ width: `${logoSize * 2}px`, height: `${logoSize}px` }}>
                            <Image
                                src={settings.businessLogoUrl!}
                                alt={`${businessName} Logo`}
                                fill
                                className="object-contain"
                                priority
                                onError={() => setLogoError(true)}
                                sizes={`${logoSize * 2}px`}
                            />
                        </div>
                    ) : (
                        <Logo className="h-12 w-12 text-primary print:h-8 print:w-8" />
                    )}
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-primary print:text-xl">
                    {businessName}
                </h1>
                <div className="text-sm text-muted-foreground mt-2 space-y-1 print:text-xs print:mt-1">
                    {(settings?.businessAddress || settings?.businessCity || settings?.businessState || settings?.businessZipCode || settings?.businessCountry) && (
                        <p>
                            {[settings?.businessAddress, settings?.businessCity, settings?.businessState].filter(Boolean).join(', ')}
                            {settings?.businessZipCode && ` ${settings.businessZipCode}`}
                            {settings?.businessCountry && `, ${settings.businessCountry}`}
                        </p>
                    )}
                    {(settings?.businessPhone || settings?.businessEmail) && (
                        <p>
                            {settings?.businessPhone && <span>{settings.businessPhone}</span>}
                            {settings?.businessEmail && settings.businessPhone && <span> &middot; </span>}
                            {settings?.businessEmail && <span>{settings.businessEmail}</span>}
                        </p>
                    )}
                </div>

                <Separator className="my-4 print:my-2" />

                <h2 className="text-2xl font-bold tracking-tight print:text-lg">
                    Guest Folio
                </h2>
            </header>

        <Card className="print:shadow-none print:border print:break-inside-avoid">
            <CardHeader className="flex flex-row items-center justify-between pb-2 print:pb-1">
                <CardTitle className="text-sm font-medium print:text-xs">Guest Information</CardTitle>
                 <Avatar className="h-10 w-10 border-2 print:border print:h-8 print:w-8">
                    <AvatarImage src={booking?.guestPhotoURL || ''} />
                    <AvatarFallback>{getInitials(booking?.guestName || 'G')}</AvatarFallback>
                </Avatar>
            </CardHeader>
            <CardContent className="print:py-2">
                <h3 className="font-bold text-2xl print:text-lg">{booking?.guestName}</h3>
                <p className="text-sm text-muted-foreground print:text-xs">Room {booking?.roomNumber}</p>
                 <Separator className="my-4 print:my-2" />
                <div className="space-y-2 text-sm print:space-y-1 print:text-xs">
                     <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground print:h-3 print:w-3" /><span>{booking.guestEmail || 'Not provided'}</span></div>
                    <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground print:h-3 print:w-3" /><span>{booking.guestPhoneNumber || 'Not provided'}</span></div>
                    <div className="flex items-center gap-3"><LogIn className="h-4 w-4 text-muted-foreground print:h-3 print:w-3" /><span><strong>Check-in:</strong> {checkIn ? format(checkIn, 'PPp') : 'N/A'}</span></div>
                    <div className="flex items-center gap-3"><LogOut className="h-4 w-4 text-muted-foreground print:h-3 print:w-3" /><span><strong>Check-out:</strong> {scheduledCheckoutDate ? format(scheduledCheckoutDate, 'PPp') : 'N/A'}</span></div>
                </div>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:grid-cols-3 print:break-inside-avoid">
            <Card className="print:shadow-none print:border">
                <CardHeader className="flex flex-row items-center justify-between pb-2 print:pb-1">
                    <CardTitle className="text-sm font-medium print:text-xs">Total Bill</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground print:h-3 print:w-3" />
                </CardHeader>
                <CardContent className="print:py-2">
                    <p className="text-2xl font-bold print:text-lg">{formatCurrency(totalCharges)}</p>
                    <p className="text-xs text-muted-foreground print:text-[10px]">Total amount of all charges</p>
                </CardContent>
            </Card>
             <Card className="print:shadow-none print:border">
                <CardHeader className="flex flex-row items-center justify-between pb-2 print:pb-1">
                    <CardTitle className="text-sm font-medium print:text-xs">Total Paid</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground print:h-3 print:w-3" />
                </CardHeader>
                <CardContent className="print:py-2">
                    {balance > 0 ? (
                        <p className="text-2xl font-bold text-orange-500 print:text-lg">{formatCurrency(totalPayments)}</p>
                    ) : (
                        <p className="text-2xl font-bold text-green-600 print:text-lg">{formatCurrency(totalPayments)}</p>
                    )}
                    <p className="text-xs text-muted-foreground print:text-[10px]">Total payments made</p>
                </CardContent>
            </Card>
            <Card className="print:shadow-none print:border">
                <CardHeader className="flex flex-row items-center justify-between pb-2 print:pb-1">
                    <CardTitle className="text-sm font-medium print:text-xs">Balance Due</CardTitle>
                    <Receipt className="h-4 w-4 text-muted-foreground print:h-3 print:w-3" />
                </CardHeader>
                <CardContent className="print:py-2">
                    {balance > 0 ? (
                        <p className="text-2xl font-bold text-red-600 print:text-lg">{formatCurrency(balance)}</p>
                    ) : (
                        <p className="text-2xl font-bold text-green-600 print:text-lg">{formatCurrency(balance)}</p>
                    )}
                    <p className="text-xs text-muted-foreground print:text-[10px]">{balance > 0 ? 'Remaining amount to be paid' : 'Settled'}</p>
                </CardContent>
            </Card>
         </div>

        <div className="grid grid-cols-1 gap-6 mt-6 print:grid-cols-1 print:gap-4 print:mt-4">
             <section className="print:break-inside-avoid">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 print:text-sm print:mb-2"><Receipt className="w-5 h-5 text-muted-foreground print:w-4 print:h-4" /> Charges & Services</h3>
                <Card className="overflow-hidden print:shadow-none print:border">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold print:px-2 print:py-1 print:text-[10px]">Date &amp; Time</th>
                                    <th className="px-4 py-2 text-left font-semibold print:px-2 print:py-1 print:text-[10px]">Description</th>
                                    <th className="px-4 py-2 text-right font-semibold print:px-2 print:py-1 print:text-[10px]">Charge</th>
                                    <th className="px-4 py-2 text-center font-semibold print:px-2 print:py-1 print:text-[10px]">Status</th>
                                    {!readOnly && (
                                        <th className="px-4 py-2 text-right font-semibold print:hidden">Action</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {allCharges.map(charge => (
                                    <ChargeRow
                                        key={charge.id}
                                        charge={charge}
                                        formatCurrency={formatCurrency}
                                        onReturnItem={onReturnItem}
                                        readOnly={readOnly}
                                        billsPrinted={billsPrinted}
                                    />
                                ))}
                            </tbody>
                            <tfoot className="bg-muted/40 border-t">
                                <tr>
                                    <td colSpan={2} className="px-4 py-3 text-right font-semibold print:px-2 print:py-1 print:text-xs">Total Charges</td>
                                    <td className="px-4 py-3 text-right font-bold print:px-2 print:py-1 print:text-xs">{formatCurrency(totalCharges)}</td>
                                    <td className="px-4 py-3 print:px-2" />
                                    {!readOnly && <td className="px-4 py-3 print:hidden" />}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </Card>
            </section>

            <section className="print:break-inside-avoid">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 print:text-sm print:mb-2"><CreditCard className="w-5 h-5 text-muted-foreground print:w-4 print:h-4" /> Payment History</h3>
                <Card className="overflow-hidden print:shadow-none print:border">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold print:px-2 print:py-1 print:text-[10px]">Date &amp; Time</th>
                                    <th className="px-4 py-2 text-left font-semibold print:px-2 print:py-1 print:text-[10px]">Description</th>
                                    <th className="px-4 py-2 text-right font-semibold print:px-2 print:py-1 print:text-[10px]">Amount</th>
                                    <th className="px-4 py-2 text-center font-semibold print:px-2 print:py-1 print:text-[10px]">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allPaymentTransactions.length > 0 ? (
                                    allPaymentTransactions.map(p => (
                                        <tr key={p.id} className="border-b last:border-b-0">
                                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap align-top print:px-2 print:py-1">
                                                <span className="print:hidden">{p.date ? format(p.date, 'PPp') : 'N/A'}</span>
                                                <span className="hidden print:inline">{p.date ? format(p.date, 'PP') : 'N/A'}</span>
                                            </td>
                                            <td className="px-4 py-3 align-top print:px-2 print:py-1">
                                                <p className="font-medium text-sm print:text-xs">{p.description}</p>
                                            </td>
                                            <td className={`px-4 py-3 text-right font-semibold text-sm align-top print:px-2 print:py-1 ${p.payment < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                                                {p.payment < 0 ? `-` : ''}{formatCurrency(Math.abs(p.payment))}
                                            </td>
                                            <td className="px-4 py-3 text-center align-top print:px-2 print:py-1">
                                                <Badge variant={p.payment < 0 ? 'destructive' : 'success'} className="text-xs print:text-[10px] print:px-1 print:py-0">
                                                    {p.payment < 0 ? 'Refund' : 'Paid'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm print:py-4">
                                            No payment transactions recorded
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-muted/40 border-t">
                                <tr>
                                    <td colSpan={2} className="px-4 py-3 text-right font-semibold print:px-2 print:py-1 print:text-xs">Total Paid</td>
                                    <td className="px-4 py-3 text-right font-bold text-emerald-600 print:px-2 print:py-1 print:text-xs">{formatCurrency(totalPayments)}</td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td colSpan={2} className="px-4 py-3 text-right font-semibold print:px-2 print:py-1 print:text-xs">Balance Due</td>
                                    <td className={`px-4 py-3 text-right font-bold print:px-2 print:py-1 print:text-xs ${balance === 0 ? 'text-emerald-600' : 'text-destructive'}`}>{formatCurrency(balance)}</td>
                                    <td className="px-4 py-3 text-center print:px-2 print:py-1">
                                        <Badge variant={balance === 0 ? 'success' : 'warning'} className="text-xs print:text-[10px] print:px-1 print:py-0">
                                            {balance === 0 ? 'Settled' : 'Pending'}
                                        </Badge>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </Card>
            </section>
        </div>
    </div>
  );
};
