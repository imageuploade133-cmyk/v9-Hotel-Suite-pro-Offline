
'use client';

import * as React from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Customer, Booking, Payment, StockSale, StockReturn } from '@/lib/types';
import { getInitials, getSafeDate } from '@/lib/helpers';
import { ArrowLeft, Briefcase, Calendar as CalendarIcon, ChevronDown, CreditCard, DollarSign, Info, MoreVertical, Phone, Printer, ShoppingCart, Undo2, Bed } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { collection, query, where, doc, documentId, getDocs, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { useSettings } from '@/contexts/settings-context';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import { ReprintReceiptDialog } from '@/components/payments/reprint-receipt-dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StockSaleReceiptDialog } from '@/components/stock/stock-sale-receipt-dialog';
import type { CreditSale } from '@/app/(protected)/credit-sales/columns';
import { RecordCreditPaymentDialog } from '@/components/stock/record-credit-payment-dialog';
import { writeBatch } from 'firebase/firestore';
import { useUser } from '@/contexts/user-context';
import { CreditPaymentReceiptDialog } from '@/components/customers/credit-payment-receipt-dialog';
import { PayCreditDialog } from '@/components/customers/pay-credit-dialog';
import CustomerDetailsLoading from './loading';

type Transaction = (StockSale | Payment | StockReturn | Booking) & { transactionType: 'Sale' | 'Payment' | 'Return' | 'Booking' };


function TransactionHistory({ transactions, currency, customer }: { transactions: Transaction[], currency: string, customer: Customer }) {
    const [openItem, setOpenItem] = React.useState<string | null>(null);
    const [saleToPrint, setSaleToPrint] = React.useState<StockSale | null>(null);
    const [bookingReceiptToPrint, setBookingReceiptToPrint] = React.useState<Booking | null>(null);

    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', {style: 'currency', currency}).format(value);

    const paymentForBookingReceipt: Payment | null = React.useMemo(() => {
        if (!bookingReceiptToPrint) return null;
        return {
          id: bookingReceiptToPrint.bookingId || bookingReceiptToPrint.id,
          guestName: bookingReceiptToPrint.guestName,
          guestEmail: bookingReceiptToPrint.guestEmail,
          guestPhotoURL: bookingReceiptToPrint.guestPhotoURL,
          roomNumber: bookingReceiptToPrint.roomNumber!,
          amount: bookingReceiptToPrint.totalAmount || 0,
          paymentMethod: bookingReceiptToPrint.paymentMethod || 'On-site',
          status: 'Paid',
          transactionDate: getSafeDate(bookingReceiptToPrint.checkInDate) || new Date(),
          bookingDetails: bookingReceiptToPrint,
          createdByUid: '',
        };
      }, [bookingReceiptToPrint]);

    return (
        <div className="space-y-3">
            {transactions.map(t => {
                const date = getSafeDate((t as any).soldAt || (t as any).transactionDate || (t as any).returnedAt || (t as any).createdAt);

                let icon: React.ReactNode, title: string, amount: number, amountClass: string;

                switch (t.transactionType) {
                    case 'Sale':
                        const sale = t as StockSale;
                        icon = <ShoppingCart className="h-5 w-5 text-blue-500" />;
                        title = `Sale #${sale.saleId}`;
                        amount = sale.totalAmount;
                        amountClass = 'text-foreground';
                        break;
                    case 'Payment':
                        const payment = t as Payment;
                        icon = <CreditCard className="h-5 w-5 text-green-500" />;
                        title = `Credit Repayment`;
                        amount = -payment.amount;
                        amountClass = 'text-green-600';
                        break;
                    case 'Return':
                        const ret = t as StockReturn;
                        icon = <Undo2 className="h-5 w-5 text-yellow-600" />;
                        title = `Return for Sale #${(ret as any).originalSaleId?.substring(0,8)}`;
                        amount = -ret.totalRefundAmount;
                        amountClass = 'text-yellow-600';
                        break;
                    case 'Booking':
                        const booking = t as Booking;
                        icon = <Bed className="h-5 w-5 text-indigo-500" />;
                        title = `Room Booking #${booking.bookingId}`;
                        amount = booking.totalAmount || 0;
                        amountClass = 'text-foreground';
                        break;
                    default:
                        icon = <DollarSign className="h-5 w-5" />;
                        title = "Unknown Transaction";
                        amount = 0;
                        amountClass = 'text-muted-foreground';
                }

                return (
                    <Collapsible key={t.id} open={openItem === t.id} onOpenChange={() => setOpenItem(openItem === t.id ? null : t.id)}>
                        <div className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/50">
                            <CollapsibleTrigger className="flex-1 text-left flex items-center gap-4">
                                {icon}
                                <div>
                                    <p className="font-semibold">{title}</p>
                                    <p className="text-xs text-muted-foreground">{date ? format(date, 'PPp') : 'N/A'}</p>
                                </div>
                            </CollapsibleTrigger>
                             <div className="flex items-center gap-4">
                                <p className={`font-semibold ${amountClass}`}>
                                    {amount >= 0 ? formatCurrency(amount) : `-${formatCurrency(Math.abs(amount))}`}
                                </p>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        {t.transactionType === 'Sale' && <DropdownMenuItem onClick={() => setSaleToPrint(t as StockSale)}><Printer className="mr-2 h-4 w-4" />Print Sale Receipt</DropdownMenuItem>}
                                        {t.transactionType === 'Booking' && <DropdownMenuItem onClick={() => setBookingReceiptToPrint(t as Booking)}><Printer className="mr-2 h-4 w-4" />Print Booking Receipt</DropdownMenuItem>}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </Collapsible>
                );
            })}

            <StockSaleReceiptDialog
                isOpen={!!saleToPrint}
                onClose={() => setSaleToPrint(null)}
                sale={saleToPrint}
            />
            <ReprintReceiptDialog
                isOpen={!!bookingReceiptToPrint}
                onClose={() => setBookingReceiptToPrint(null)}
                payment={paymentForBookingReceipt}
            />
        </div>
    )
}

function CustomerDetails({ customerId, customerData }: { customerId: string, customerData: any }) {
    const router = useRouter();
    const firestore = useFirestore();

    // Re-hydrate the customer object from serialized data
    const customer: Customer = {
        ...customerData,
        lastVisit: getSafeDate(customerData.lastVisit),
        createdAt: getSafeDate(customerData.createdAt),
    };

    const { data: bookings, isLoading: isLoadingBookings } = useCollection<Booking>(
        React.useMemo(() => {
            if (!firestore || !customerId) return null;
            return query(collection(firestore, 'bookings'), where('customerId', '==', customerId), orderBy('createdAt', 'desc'));
        }, [firestore, customerId])
    );

    if (!customer) return <CustomerDetailsLoading />;

    return (
        <div className="flex flex-col gap-6">
             <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                    <AvatarImage src={customer.photoURL} />
                    <AvatarFallback className="text-2xl">{getInitials(customer.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <h2 className="text-3xl font-bold">{customer.name}</h2>
                    <p className="text-muted-foreground">{customer.email}</p>
                </div>
            </div>

            <Separator />
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-semibold">Booking History</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingBookings ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : bookings && bookings.length > 0 ? (
                        <div className="space-y-3">
                            {bookings.map(booking => (
                                <div key={booking.id} className="flex items-center justify-between rounded-md border p-3">
                                    <div>
                                        <p className="font-semibold">Room {booking.roomNumber}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {getSafeDate(booking.checkInDate) ? format(getSafeDate(booking.checkInDate)!, 'PP') : 'N/A'} - {getSafeDate(booking.checkOutDate) ? format(getSafeDate(booking.checkOutDate)!, 'PP') : 'N/A'}
                                        </p>
                                    </div>
                                    <Badge variant="secondary">{booking.status}</Badge>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="py-4 text-center text-sm text-muted-foreground">No booking history found for this customer.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function CustomerPageComponent({ customerData }: { customerData: any }) {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
             <Button variant="ghost" onClick={() => router.back()} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Customers
            </Button>
            <CustomerDetails customerId={id} customerData={customerData} />
        </div>
    );
}

export default withAuth(CustomerPageComponent, PagePermission.VIEW_CUSTOMERS_PAGE);
