
import React from 'react';
import { Booking, Bill, Payment } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, AlertCircle } from 'lucide-react';

interface GuestTotalBillProps {
  booking: Booking;
  allBills: Bill[] | null;
  allPayments: Payment[] | null;
  isLoading: boolean;
}

export function GuestTotalBill({ booking, allBills, allPayments, isLoading }: GuestTotalBillProps) {
  const { totalBill, totalPaid, balance, roomCharge, otherCharges } = React.useMemo(() => {
    const billsForBooking = allBills?.filter(b => (b as any).bookingId === booking.id) || [];
    const paymentsForBooking = allPayments?.filter(p => p.bookingId === booking.id) || [];

    const otherCharges = billsForBooking.reduce((acc, bill) => acc + bill.total, 0);
    const roomCharge = booking.totalAmount || 0;
    const totalBill = otherCharges + roomCharge;

    // Room charge is always paid per business logic
    // Add room charge to total paid
    const paidPayments = paymentsForBooking
      .filter(payment => payment.status !== 'Refunded')
      .reduce((acc, payment) => acc + payment.amount, 0);

    const totalPaid = roomCharge + paidPayments;

    // Balance = only unpaid additional charges (room charge is always paid)
    const balance = Math.max(0, otherCharges - paidPayments);

    return { totalBill, totalPaid, balance, roomCharge, otherCharges };
  }, [allBills, allPayments, booking.id, booking.totalAmount]);

  if (isLoading) {
    return (
        <Card className="bg-blue-50 dark:bg-blue-900/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg">Guest Bill</CardTitle>
            </CardHeader>
            <CardContent>
                <Skeleton className="h-24 w-full" />
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="bg-blue-50 dark:bg-blue-900/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Guest Bill</span>
          <DollarSign className="h-5 w-5 text-blue-500" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Room Charge:</span>
            <span className="font-medium">{formatCurrency(roomCharge)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Other Charges:</span>
            <span className="font-medium">{formatCurrency(otherCharges)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-1 border-t mt-1">
            <span>Total Bill:</span>
            <span>{formatCurrency(totalBill)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Paid:</span>
            <span className="font-medium text-green-600">{formatCurrency(totalPaid)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-1 border-t mt-1">
            <span>Balance Due:</span>
            <span className={balance > 0 ? 'text-destructive' : ''}>{formatCurrency(balance)}</span>
          </div>
        </div>
        {balance > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 p-2 bg-orange-50 dark:bg-orange-900/30 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span>Guest has an outstanding balance.</span>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
