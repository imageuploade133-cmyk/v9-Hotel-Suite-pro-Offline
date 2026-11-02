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
import { UserCog, CircleX, LogIn, Info } from 'lucide-react';
import type { Booking, Bill, Payment } from '@/lib/types';
import { useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { GuestFolio } from './guest-folio';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BookingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  onReassign?: (booking: Booking) => void;
  onCheckIn?: (booking: Booking) => void;
  onCancel?: (booking: Booking) => void;
  onViewImage?: (url: string) => void;
}

function BookingDetailsContent({
  booking,
  onReassign,
  onCheckIn,
  onCancel,
  onClose,
  onViewImage,
}: Omit<BookingDetailsDialogProps, 'open'> & { onClose: () => void }) {
  const firestore = useFirestore();
  const billsQuery = useCollection<Bill>(
    booking ? query(collection(firestore, `bookings/${booking.id}/bills`)) : null
  );
  const paymentsQuery = useCollection<Payment>(
    booking ? query(collection(firestore, 'payments'), where('bookingId', '==', booking.id)) : null
  );

  const billsPrinted = React.useMemo(() => {
    if (!billsQuery.data || billsQuery.data.length === 0) return false;
    return billsQuery.data.some(bill => bill.printStatus === 'printed');
  }, [billsQuery.data]);

  if (!booking) return null;

  const isReservation = booking.status === 'Booked' || booking.status === 'Reserved';

  return (
    <>
      <ScrollArea className="min-h-0 flex-1 -mx-4 sm:-mx-6">
        <div className="min-w-0 space-y-6 px-4 sm:px-6">
          <GuestFolio
            booking={booking}
            allBills={billsQuery.data}
            allPayments={paymentsQuery.data}
            allReturns={null}
            onReturnItem={() => {}}
            onBack={() => {}}
            onViewImage={onViewImage}
            billsPrinted={billsPrinted}
          />
          {booking.customFields && Object.keys(booking.customFields).length > 0 && (
            <section className="space-y-4">
              <h4 className="font-semibold">Additional Information</h4>
              <div className="space-y-3 rounded-lg bg-muted/50 p-4 text-sm">
                {Object.entries(booking.customFields).map(([key, value]) => (
                  <div key={key} className="flex min-w-0 items-start gap-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 break-words">
                      <strong>{key}:</strong> {String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </ScrollArea>

      <DialogFooter className="shrink-0 pt-3 sm:pt-4">
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:justify-end">
          {onReassign && isReservation && (
            <Button
              variant="outline"
              className="w-full whitespace-normal leading-tight sm:w-auto"
              onClick={() => {
                onClose();
                onReassign(booking);
              }}
            >
              <UserCog className="mr-2 h-4 w-4 shrink-0" />
              Reassign Room
            </Button>
          )}
          {isReservation && onCancel && (
            <Button
              variant="destructive"
              className="w-full whitespace-normal leading-tight sm:w-auto"
              onClick={() => onCancel(booking)}
            >
              <CircleX className="mr-2 h-4 w-4 shrink-0" />
              Cancel Reservation
            </Button>
          )}
          {isReservation && onCheckIn && (
            <Button className="w-full whitespace-normal leading-tight sm:w-auto" onClick={() => onCheckIn(booking)}>
              <LogIn className="mr-2 h-4 w-4 shrink-0" />
              Check In
            </Button>
          )}
          <Button variant="secondary" className="w-full sm:w-auto" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

export function BookingDetailsDialog({ open, onOpenChange, ...props }: BookingDetailsDialogProps) {
  const { booking } = props;

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-h-0 overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>Booking Details</DialogTitle>
          <DialogDescription>
            Detailed information for the booking in Room {booking.roomNumber}.
          </DialogDescription>
        </DialogHeader>
        <BookingDetailsContent {...props} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
