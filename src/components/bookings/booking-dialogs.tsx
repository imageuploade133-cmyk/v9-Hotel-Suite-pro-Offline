
'use client';

import * as React from 'react';
import { WalkInDialog } from '@/components/bookings/walk-in-dialog';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import { CheckOutDialog } from '@/components/bookings/checkout-dialog';
import { CheckInDialog } from '@/components/bookings/checkin-dialog';
import { ReprintReceiptDialog } from '@/components/payments/reprint-receipt-dialog';
import { CancelBookingDialog } from '@/components/bookings/cancel-booking-dialog';
import { CancellationInvoiceDialog } from '@/components/bookings/cancellation-invoice-dialog';
import { AddBillDialog } from '@/components/bookings/add-bill-dialog';
import { UnpaidInvoiceDialog } from '@/components/bookings/unpaid-invoice-dialog';
import { PayBillsDialog } from '@/components/bookings/pay-bills-dialog';
import { MarkAsPaidDialog } from '@/components/bookings/mark-as-paid-dialog';
import { GuestFolioDialog } from '@/components/bookings/guest-folio-dialog';
import { EditReservationDialog } from '@/components/bookings/edit-reservation-dialog';
import type { Booking, Room, Payment, Bill, BillItem, Order } from '@/lib/types';
import { useBookings } from '@/hooks/use-bookings';
import { GuestBillDialog } from './guest-bill-dialog';
import { RenewBookingDialog } from './renew-booking-dialog';

export function BookingDialogs({
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
  reloadBookings,
}: any) {

  const { rooms, isLoading, allBookings, allBillsData, additionalPaymentsData, refetchBills } = useBookings();

  const {
    isNewBookingOpen,
    initialDateRange,
    initialBookingType,
    walkInRoom,
    reassignBooking,
    detailsBooking,
    bookingToCheckout,
    bookingToCheckIn,
    bookingToReprint,
    bookingToCancel,
    isCancelling,
    cancellationInvoiceBooking,
    bookingToAddBill,
    bookingToViewBill,
    bookingToPayBills,
    bookingToMarkAsPaid,
    bookingToEdit,
    isGuestFolioOpen,
    bookingToRenew,
  } = actionState;

  const vacantRoomsForBooking = React.useMemo(() => {
    if (!rooms) return [];

    const nonVacantRoomNumbers = new Set<string>();
    rooms.forEach(roomType => {
      if (roomType.individualRoomStatus) {
        Object.entries(roomType.individualRoomStatus).forEach(([roomNumber, status]) => {
          if (status && status.toLowerCase() !== 'vacant') {
            nonVacantRoomNumbers.add(roomNumber);
          }
        });
      }
    });

    return rooms.filter(roomType => {
      if (!roomType.roomNumbers) return false;
      return roomType.roomNumbers.some(roomNumber => !nonVacantRoomNumbers.has(roomNumber));
    });
  }, [rooms]);

  return (
    <>
      <WalkInDialog
        isOpen={isNewBookingOpen || !!reassignBooking || !!walkInRoom}
        room={walkInRoom}
        templateBooking={reassignBooking}
        availableRooms={vacantRoomsForBooking}
        onClose={() => {
          setActionState({ ...actionState, isNewBookingOpen: false, walkInRoom: null, reassignBooking: null });
        }}
        onSuccess={handleBookingSuccess}
        initialDateRange={initialDateRange}
        initialBookingType={initialBookingType}
      />
      <BookingDetailsDialog
        open={!!detailsBooking}
        onOpenChange={(open) => !open && setActionState({ ...actionState, detailsBooking: null })}
        booking={detailsBooking}
        onReassign={(booking: Booking) => setActionState({ ...actionState, reassignBooking: booking, detailsBooking: null })}
        onCheckIn={(booking: Booking) => setActionState({ ...actionState, bookingToCheckIn: booking, detailsBooking: null })}
        onCancel={(booking: Booking) => setActionState({ ...actionState, bookingToCancel: booking, detailsBooking: null })}
      />
      {bookingToCheckout && <CheckOutDialog isOpen={!!bookingToCheckout} booking={bookingToCheckout} onClose={() => setActionState({ ...actionState, bookingToCheckout: null })} onCheckOut={(booking, staffName, notes) => confirmCheckout(booking, staffName, notes)} />}
      <CheckInDialog
        isOpen={!!bookingToCheckIn}
        booking={bookingToCheckIn}
        totalAmount={bookingToCheckIn ? rooms?.find(r => r.id === bookingToCheckIn.roomId)?.price : undefined}
        onClose={() => setActionState({ ...actionState, bookingToCheckIn: null })}
        onCheckIn={handleCheckIn}
        availableRooms={rooms || []}
      />
      <ReprintReceiptDialog
        isOpen={!!bookingToReprint && !!bookingToReprint.paymentMethod}
        onClose={() => setActionState({ ...actionState, bookingToReprint: null })}
        payment={paymentForReceipt}
      />
      <UnpaidInvoiceDialog
        isOpen={!!bookingToReprint && !bookingToReprint.paymentMethod}
        onClose={() => setActionState({ ...actionState, bookingToReprint: null })}
        booking={bookingToReprint}
      />
      <CancelBookingDialog isOpen={!!bookingToCancel} booking={bookingToCancel} onClose={() => setActionState({ ...actionState, bookingToCancel: null })} onConfirm={() => confirmCancel(bookingToCancel!)} isCancelling={isCancelling} />
      <CancellationInvoiceDialog
        isOpen={!!cancellationInvoiceBooking}
        onClose={() => setActionState({ ...actionState, cancellationInvoiceBooking: null })}
        booking={cancellationInvoiceBooking}
      />
      {bookingToAddBill && (
        <AddBillDialog
          booking={bookingToAddBill}
          isOpen={!!bookingToAddBill}
          onClose={() => setActionState({ ...actionState, bookingToAddBill: null })}
          onConfirm={handleAddBill}
        />
      )}
       <GuestBillDialog
        isOpen={!!bookingToViewBill}
        onClose={() => setActionState({ ...actionState, bookingToViewBill: null })}
        booking={bookingToViewBill}
        allBills={allBillsData}
        allPayments={additionalPaymentsData}
        isLoading={isLoading}
      />
      {bookingToPayBills && (
        <PayBillsDialog
          booking={bookingToPayBills}
          isOpen={!!bookingToPayBills}
          onClose={() => setActionState({ ...actionState, bookingToPayBills: null })}
          onConfirm={handlePayBills}
        />
      )}
      <MarkAsPaidDialog
        isOpen={!!bookingToMarkAsPaid}
        onClose={() => setActionState({ ...actionState, bookingToMarkAsPaid: null })}
        booking={bookingToMarkAsPaid}
        onConfirm={handleConfirmMarkAsPaid}
      />
      <EditReservationDialog
        isOpen={!!bookingToEdit}
        onClose={() => setActionState({ ...actionState, bookingToEdit: null })}
        booking={bookingToEdit}
        onSuccess={reloadBookings}
      />
      <GuestFolioDialog
        isOpen={isGuestFolioOpen}
        onClose={() => setActionState({ ...actionState, isGuestFolioOpen: false })}
        allBookings={allBookings}
        allBills={allBillsData}
        allPayments={additionalPaymentsData}
        isLoading={isLoading}
        onBillPrinted={refetchBills}
      />
      <RenewBookingDialog
        isOpen={!!bookingToRenew}
        onClose={() => setActionState({ ...actionState, bookingToRenew: null })}
        booking={bookingToRenew}
        room={rooms?.find(r => r.id === bookingToRenew?.roomId)}
        onSuccess={reloadBookings}
      />
    </>
  );
}