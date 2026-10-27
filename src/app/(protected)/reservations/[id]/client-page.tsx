
'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore } from '@/firebase';
import type { Booking } from '@/lib/types';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, CircleX, Edit, FileText, LogIn, Globe } from 'lucide-react';
import { ReprintReceiptDialog } from '@/components/payments/reprint-receipt-dialog';
import { CancelBookingDialog } from '@/components/bookings/cancel-booking-dialog';
import { EditReservationDialog } from '@/components/bookings/edit-reservation-dialog';
import { UnpaidInvoiceDialog } from '@/components/bookings/unpaid-invoice-dialog';
import { getSafeDate } from '@/lib/helpers';
import { useBookingActions } from '@/components/bookings/use-booking-actions';
import { BookingDialogs } from '@/components/bookings/booking-dialogs';
import { Badge } from '@/components/ui/badge';

function ReservationActionClientPage({ bookingData }: { bookingData: any }) {
  const router = useRouter();

  const booking: Booking = {
      ...bookingData,
      createdAt: getSafeDate(bookingData.createdAt),
      checkInDate: getSafeDate(bookingData.checkInDate),
      checkOutDate: getSafeDate(bookingData.checkOutDate),
      actualCheckOutDate: getSafeDate(bookingData.actualCheckOutDate),
      cancelledAt: getSafeDate(bookingData.cancelledAt),
      refundedAt: getSafeDate(bookingData.refundedAt),
  };

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
    handleToggleCollectPayment,
  } = useBookingActions({
    rooms: null,
    onSuccess: () => router.push('/reservations'),
  });

  return (
    <>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reservations
        </Button>
        <div className="p-6 border rounded-lg">
          <h1 className="text-2xl font-bold">Actions for {booking.guestName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground">Room {booking.roomNumber}</p>
            {booking.source && (
              <Badge variant={booking.source === 'website' ? 'default' : 'secondary'}>
                {booking.source === 'website' && <Globe className="mr-1.5 h-3.5 w-3.5" />}
                {booking.source.charAt(0).toUpperCase() + booking.source.slice(1)}
              </Badge>
            )}
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button onClick={() => setActionState(prev => ({...prev, bookingToCheckIn: booking}))}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Check In Guest
              </Button>
              <Button variant="outline" onClick={() => setActionState(prev => ({ ...prev, bookingToEdit: booking }))}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Reservation
              </Button>
              {booking.paymentMethod ? (
                  <Button variant="outline" onClick={() => setActionState(prev => ({ ...prev, bookingToReprint: booking }))}>
                      <Printer className="mr-2 h-4 w-4" />
                      Reprint Receipt
                  </Button>
              ) : (
                  <Button variant="outline" onClick={() => setActionState(prev => ({ ...prev, bookingToReprint: booking }))}>
                      <FileText className="mr-2 h-4 w-4" />
                      Reprint Invoice
                  </Button>
              )}
              <Button variant="destructive" onClick={() => setActionState(prev => ({...prev, bookingToCancel: booking}))}>
                  <CircleX className="mr-2 h-4 w-4" />
                  Cancel Reservation
              </Button>
          </div>
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
      />
    </>
  );
}

export default withAuth(ReservationActionClientPage, PagePermission.VIEW_BOOKINGS_PAGE);
