
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
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Bed,
  Mail,
  Phone,
  Calendar,
  LogIn,
  LogOut,
  User,
  Hash,
  DollarSign,
  CreditCard,
  Building,
  UserCog,
  CircleX,
  Info,
} from 'lucide-react';
import { format, setHours, setMinutes, parse } from 'date-fns';
import type { Booking, Bill, Payment } from '@/lib/types';
import { getInitials, getSafeDate, getCheckoutDateTime } from '@/lib/helpers';
import { useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useSettings } from '@/contexts/settings-context';
import { GuestFolio } from './guest-folio';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { BottomSheet } from '../ui/bottom-sheet';
import { ScrollArea } from '../ui/scroll-area';

interface BookingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  onReassign?: (booking: Booking) => void;
  onCheckIn?: (booking: Booking) => void;
  onCancel?: (booking: Booking) => void;
  onViewImage?: (url: string) => void;
}

function BookingDetailsContent({ booking, onReassign, onCheckIn, onCancel, onClose, onViewImage }: Omit<BookingDetailsDialogProps, 'open'> & { onClose: () => void }) {
    const firestore = useFirestore();
    const { settings } = useSettings();
    const billsQuery = useCollection<Bill>(
        booking ? query(collection(firestore, `bookings/${booking.id}/bills`)) : null
    );
    const paymentsQuery = useCollection<Payment>(
        booking ? query(collection(firestore, 'payments'), where('bookingId', '==', booking.id)) : null
    );

    if (!booking) return null;

    const isReservation = booking.status === 'Booked' || booking.status === 'Reserved';

    // Check if any bills have been printed
    const billsPrinted = React.useMemo(() => {
        if (!billsQuery.data || billsQuery.data.length === 0) return false;
        return billsQuery.data.some(bill => bill.printStatus === 'printed');
    }, [billsQuery.data]);

    return (
        <>
            <ScrollArea className="max-h-[70vh] -mx-6">
                <div className="px-6 space-y-6">
                   <GuestFolio booking={booking} allBills={billsQuery.data} allPayments={paymentsQuery.data} allReturns={null} onReturnItem={() => {}} onBack={() => {}} onViewImage={onViewImage} billsPrinted={billsPrinted} />
                    {booking.customFields && Object.keys(booking.customFields).length > 0 && (
                        <div className="space-y-4">
                            <h4 className="font-semibold">Additional Information</h4>
                            <div className="space-y-3 text-sm p-4 rounded-lg bg-muted/50">
                            {Object.entries(booking.customFields).map(([key, value]) => (
                                <div key={key} className="flex items-start gap-3">
                                <Info className="h-4 w-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                                <div>
                                    <strong>{key}:</strong> {String(value)}
                                </div>
                                </div>
                            ))}
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
                <div className='flex items-center justify-end gap-2 w-full'>
                    {onReassign && isReservation && (
                        <Button
                        variant="outline"
                        onClick={() => {
                            onClose();
                            onReassign(booking);
                        }}
                        >
                        <UserCog className="mr-2 h-4 w-4" />
                        Reassign Room
                        </Button>
                    )}
                    {isReservation && onCancel && (
                        <Button variant="destructive" onClick={() => onCancel(booking)}>
                        <CircleX className="mr-2 h-4 w-4" /> Cancel Reservation
                        </Button>
                    )}
                    {isReservation && onCheckIn && (
                        <Button onClick={() => onCheckIn(booking)}>
                            <LogIn className="mr-2 h-4 w-4" /> Check In
                        </Button>
                    )}
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </DialogFooter>
        </>
    )
}

export function BookingDetailsDialog({ open, onOpenChange, ...props }: BookingDetailsDialogProps) {
  const isMobile = useIsMobile();
  const { booking } = props;

  if (!booking) return null;

  if (isMobile) {
    return (
        <BottomSheet open={open} onOpenChange={onOpenChange}>
            <div className="p-4 flex flex-col h-full">
                <div className="mb-4">
                    <h2 className="text-lg font-semibold">Booking Details</h2>
                    <p className="text-sm text-muted-foreground">Room {booking.roomNumber}</p>
                </div>
                <BookingDetailsContent {...props} onClose={() => onOpenChange(false)} />
            </div>
        </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
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
