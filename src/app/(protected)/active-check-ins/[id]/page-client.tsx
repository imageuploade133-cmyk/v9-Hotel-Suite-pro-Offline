
'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import type { Booking, Bill, Payment } from '@/lib/types';
import { notFound, useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Printer,
  CircleX,
  FileText,
  CreditCard,
  Wallet,
  PlusCircle,
  Download,
} from 'lucide-react';
import ActionPageLoading from './loading';
import { useBookingActions } from '@/components/bookings/use-booking-actions';
import { BookingDialogs } from '@/components/bookings/booking-dialogs';
import { getSafeDate, formatCurrency } from '@/lib/helpers';
import { useSettings } from '@/contexts/settings-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

function ActionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const firestore = useFirestore();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';

  const bookingRef = React.useMemo(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'bookings', id);
  }, [firestore, id]);

  const { data: booking, isLoading: bookingLoading } = useDoc<Booking>(bookingRef);

  const billsQuery = React.useMemo(() => {
    if (!firestore || !id) return null;
    return query(
      collection(firestore, 'bills'),
      where('bookingId', '==', id),
      orderBy('createdAt', 'asc')
    );
  }, [firestore, id]);
  const { data: bills, isLoading: billsLoading } = useCollection<Bill>(billsQuery);

  const paymentsQuery = React.useMemo(() => {
    if (!firestore || !id) return null;
    return query(
      collection(firestore, 'payments'),
      where('bookingId', '==', id),
      orderBy('transactionDate', 'asc')
    );
  }, [firestore, id]);
  const { data: payments, isLoading: paymentsLoading } = useCollection<Payment>(paymentsQuery);

  const {
    actionState,
    setActionState,
    handleBookingSuccess,
    confirmCheckout,
    handleCheckIn,
    paymentForReceipt,
    confirmCancel,
    handleAddBill,
    handlePayBills,
    handleConfirmMarkAsPaid,
  } = useBookingActions({
    rooms: null,
    onSuccess: () => router.refresh(),
  });

  const history = React.useMemo(() => {
    if (!bills || !payments || !booking) return [];

    const roomCharge = {
      id: 'room-charge',
      type: 'room',
      date: getSafeDate(booking.checkInDate),
      description: `Room Charge (${booking.roomNumber})`,
      amount: booking.totalAmount || 0,
    };

    const billItems = bills.map((item) => ({
      ...item,
      type: 'bill',
      date: getSafeDate(item.createdAt),
      description: `Additional Bill #${item.id.slice(0, 5)}`,
      amount: item.total,
    }));

    const paymentItems = payments.map((item) => ({
      ...item,
      type: 'payment',
      date: getSafeDate(item.transactionDate),
      description: `${item.paymentMethod} Payment`,
      amount: -item.amount,
    }));

    return [roomCharge, ...billItems, ...paymentItems].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }, [bills, payments, booking]);

  if (bookingLoading || billsLoading || paymentsLoading) {
    return <ActionPageLoading />;
  }

  if (!booking) {
    return notFound();
  }

  const totalRoomCharges = booking.totalAmount || 0;
  const totalBillCharges = bills?.reduce((acc, bill) => acc + bill.total, 0) || 0;
  const totalCharges = totalRoomCharges + totalBillCharges;
  const totalPaid = payments?.reduce((acc, payment) => acc + payment.amount, 0) || 0;
  const balanceDue = totalCharges - totalPaid;

  return (
    <>
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Check-ins
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Booking History</CardTitle>
              <CardDescription>
A timeline of all financial transactions for this booking.
</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {history.map((item) => (
                  <div key={item.id} className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${item.type === 'payment' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'}`}>
                        {item.type === 'payment' ? (
                          <CreditCard className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </span>
                    </div>
                    <div className="flex-grow">
                      <p className="font-medium text-slate-800">{item.description}</p>
                      <p className="text-sm text-slate-500">
                        {format(item.date, 'MMM dd, yyyy, hh:mm a')}
                      </p>
                    </div>
                    <div
                      className={`text-right font-semibold ${item.amount < 0 ? 'text-green-600' : 'text-slate-800'}`}>
                      {formatCurrency(item.amount, currency)}
                    </div>
                  </div>
                ))}
                 {history.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <p>No history items to display yet.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Button onClick={() => setActionState((prev) => ({ ...prev, billBooking: booking }))}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Bill
              </Button>
               <Button onClick={() => setActionState((prev) => ({ ...prev, invoiceBooking: booking }))}>
                <Download className="mr-2 h-4 w-4" />
                Invoice
              </Button>
              <Button onClick={() => setActionState((prev) => ({ ...prev, receiptBooking: booking }))}>
                <Printer className="mr-2 h-4 w-4" />
                Receipt
              </Button>
              <Button
                variant="destructive"
                onClick={() => setActionState((prev) => ({ ...prev, bookingToCancel: booking }))}>
                <CircleX className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Financials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Room Charges</span>
                <span className="font-medium">{formatCurrency(totalRoomCharges, currency)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Additional Bills</span>
                <span className="font-medium">{formatCurrency(totalBillCharges, currency)}</span>
              </div>
               <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-slate-600">Total Charges</span>
                <span className="text-slate-900">{formatCurrency(totalCharges, currency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Total Paid</span>
                <span className="font-medium text-green-600">-{formatCurrency(totalPaid, currency)}</span>
              </div>
            </CardContent>
            <CardFooter
              className={`p-4 mt-4 rounded-b-lg ${balanceDue > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
              <div className="flex justify-between items-center w-full">
                <span
                  className={`font-bold ${balanceDue > 0 ? 'text-orange-600' : 'text-green-700'}`}>
                  Balance Due
                </span>
                <span
                  className={`font-bold text-lg ${balanceDue > 0 ? 'text-orange-700' : 'text-green-800'}`}>
                  {formatCurrency(balanceDue, currency)}
                </span>
              </div>
            </CardFooter>
          </Card>
            {balanceDue > 0 && (
             <Button size="lg" className="w-full" onClick={() => handlePayBills(booking, bills)}>
                <Wallet className="mr-2 h-4 w-4" />
                Settle Balance
              </Button>
            )}
        </div>
      </div>

      <BookingDialogs
        actionState={actionState}
        setActionState={setActionState}
        handleBookingSuccess={handleBookingSuccess}
        confirmCheckout={confirmCheckout}
        handleCheckIn={handleCheckIn}
        paymentForReceipt={paymentForReceipt}
        confirmCancel={confirmCancel}
        handleAddBill={handleAddBill}
        handlePayBills={handlePayBills}
        handleConfirmMarkAsPaid={handleConfirmMarkAsPaid}
        reloadBookings={() => router.refresh()}
        settings={settings}
      />
    </>
  );
}

export default withAuth(ActionPage, PagePermission.VIEW_BOOKINGS_PAGE);
