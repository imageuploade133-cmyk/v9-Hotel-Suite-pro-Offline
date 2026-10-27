'use client';

import * as React from 'react';
import {
  collection,
  query,
  where,
  Timestamp,
  writeBatch,
  doc,
  getDocs,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  QueryDocumentSnapshot,
  DocumentData,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import type { Booking, Payment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format, setHours, setMinutes, setSeconds } from 'date-fns';
import { EmptyState } from '../ui/empty-state';
import { AlarmClockOff, Bed, Check, LogOut, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { getInitials, getSafeDate } from '@/lib/helpers';
import { ReprintReceiptDialog } from '../payments/reprint-receipt-dialog';
import { CheckOutDialog } from '../bookings/checkout-dialog';
import { useSettings } from '@/contexts/settings-context';
import { Skeleton } from '../ui/skeleton';

const PAGE_SIZE = 10;

interface DueCheckoutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckedOut: () => void;
}

function PaginationControls({
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onPrev} disabled={!canPrev}>
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      <Button variant="outline" size="sm" onClick={onNext} disabled={!canNext}>
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function LoadingSkeleton() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="flex-1 space-y-1.5 text-right">
                         <Skeleton className="h-4 w-40 ml-auto" />
                         <Skeleton className="h-3 w-28 ml-auto" />
                    </div>
                     <Skeleton className="h-9 w-28" />
                </div>
            ))}
        </div>
    )
}

export function DueCheckoutsDialog({ isOpen, onClose, onCheckedOut }: DueCheckoutsDialogProps) {
  const firestore = useFirestore();
  const { user, userProfile } = useUser();
  const { toast } = useToast();
  const [receiptBooking, setReceiptBooking] = React.useState<Booking | null>(null);
  const [bookingToCheckout, setBookingToCheckout] = React.useState<Booking | null>(null);
  const { settings } = useSettings();
  const checkoutTime = settings?.checkoutTime || '11:00';

  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [pageDocs, setPageDocs] = React.useState<{ first: QueryDocumentSnapshot<DocumentData> | null; last: QueryDocumentSnapshot<DocumentData> | null }[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);

  const fetchBookings = React.useCallback(async (page: number) => {
    if (!firestore) return;
    setIsLoading(true);

    const [hours, minutes] = checkoutTime.split(':').map(Number);
    const overdueDeadline = setSeconds(setMinutes(setHours(new Date(), hours), minutes), 0);

    const baseQuery = query(
      collection(firestore, 'bookings'),
      where('status', 'in', ['Active', 'Checked-in']),
      where('checkOutDate', '<=', Timestamp.fromDate(overdueDeadline)),
      orderBy('checkOutDate', 'desc')
    );

    let q;
    if (page > 1 && pageDocs[page - 2]) {
        q = query(baseQuery, startAfter(pageDocs[page - 2].last), limit(PAGE_SIZE));
    } else {
        q = query(baseQuery, limit(PAGE_SIZE));
    }

    try {
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));

      setBookings(data);

      if (!snapshot.empty) {
        const first = snapshot.docs[0];
        const last = snapshot.docs[snapshot.docs.length - 1];
        setPageDocs(prev => {
            const newDocs = [...prev];
            newDocs[page-1] = { first, last };
            return newDocs;
        });
      }

    } catch (error) {
      console.error("Error fetching overdue checkouts:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch overdue checkouts.' });
    } finally {
      setIsLoading(false);
    }
  }, [firestore, checkoutTime, toast, pageDocs]);


  React.useEffect(() => {
    if (isOpen) {
        fetchBookings(currentPage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentPage]);

  const handleCheckOut = async (notes?: string) => {
    if (!firestore || !user || !userProfile || !bookingToCheckout) return;

    const batch = writeBatch(firestore);
    const actualCheckOutDate = new Date();

    const bookingRef = doc(firestore, 'bookings', bookingToCheckout.id);
    batch.update(bookingRef, {
        status: 'Checked-out',
        actualCheckOutDate: Timestamp.fromDate(actualCheckOutDate),
        checkoutNotes: notes || '',
        checkedOutByUid: user.uid,
        checkedOutByName: userProfile.name || user.displayName || 'Unknown',
    });

    if (bookingToCheckout.roomId && bookingToCheckout.roomNumber) {
        const roomRef = doc(firestore, 'rooms', bookingToCheckout.roomId);
        batch.update(roomRef, {
            bookedRooms: increment(-1),
            [`individualRoomStatus.${bookingToCheckout.roomNumber}`]: 'Cleaning in Progress',
        });

        const cleaningQueueRef = doc(collection(firestore, 'cleaning-queue'));
        batch.set(cleaningQueueRef, {
          roomId: bookingToCheckout.roomId,
          roomNumber: bookingToCheckout.roomNumber,
          lastGuestName: bookingToCheckout.guestName,
          lastGuestPhotoURL: bookingToCheckout.guestPhotoURL,
          bookingId: bookingToCheckout.id,
          checkedOutAt: Timestamp.fromDate(actualCheckOutDate),
          status: 'Pending',
        });
    }

    try {
        await batch.commit();
        toast({
            variant: 'success',
            title: 'Check-out Successful',
            description: `${bookingToCheckout.guestName} has been checked out.`,
        });
        setReceiptBooking(bookingToCheckout);
        onCheckedOut();
        fetchBookings(currentPage);
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to check out guest.',
        });
        console.error('Check-out error:', error);
        throw error;
    } finally {
        setBookingToCheckout(null);
    }
  };

    const paymentForReceipt: Payment | null = React.useMemo(() => {
    if (!receiptBooking) return null;
    return {
      id: receiptBooking.id,
      guestName: receiptBooking.guestName,
      guestEmail: receiptBooking.guestEmail,
      guestPhotoURL: receiptBooking.guestPhotoURL,
      roomNumber: receiptBooking.roomNumber!,
      amount: receiptBooking.amount,
      paymentMethod: 'On-site',
      status: 'Paid',
      transactionDate: getSafeDate(receiptBooking.checkIn) || new Date(),
      bookingDetails: receiptBooking,
      processedByUid: user?.uid || '',
    };
  }, [receiptBooking, user]);


  return (
    <>
        <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
            <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
                <AlarmClockOff className="h-7 w-7 text-yellow-500" />
                Overdue Checkouts
            </DialogTitle>
            <DialogDescription>
                The following guests are past their scheduled checkout time of {checkoutTime}.
            </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 -mx-6">
                <div className="px-6">
                    {isLoading ? (
                        <LoadingSkeleton />
                    ) : bookings.length === 0 ? (
                        <EmptyState
                            icon={Bed}
                            title="All Clear!"
                            description="There are no overdue checkouts at the moment."
                            className="my-16"
                        />
                    ) : (
                        <div className="space-y-4">
                            {bookings.map(booking => {
                                const checkoutDate = getSafeDate(booking.checkOut);
                                return (
                                <div key={booking.id} className="flex items-center gap-4 p-4 border rounded-lg">
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={booking.guestPhotoURL} />
                                        <AvatarFallback>{getInitials(booking.guestName)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <p className="font-semibold">{booking.guestName}</p>
                                        <p className="text-sm text-muted-foreground">Room {booking.roomNumber}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-2 text-destructive">
                                            <LogOut className="h-4 w-4" />
                                            <p className="font-semibold">
                                                {checkoutDate ? `Overdue by ${formatDistanceToNow(checkoutDate, { addSuffix: true })}` : 'Overdue'}
                                            </p>
                                        </div>
                                        {checkoutDate && <p className="text-xs text-muted-foreground">
                                            Was due {format(checkoutDate, "EEEE, MMM d, p")}
                                        </p>}
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => setBookingToCheckout(booking)}
                                    >
                                        <Check className="mr-2 h-4 w-4" />
                                        Check Out
                                    </Button>
                                </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </ScrollArea>
             <DialogFooter className="pt-4 border-t sm:justify-between">
                <Button variant="outline" onClick={onClose}>
                    <X className="mr-2 h-4 w-4" />
                    Close
                </Button>
                 {!isLoading && bookings.length > 0 && (
                     <PaginationControls
                        canPrev={currentPage > 1}
                        canNext={bookings.length === PAGE_SIZE}
                        onPrev={() => setCurrentPage(p => Math.max(1, p - 1))}
                        onNext={() => setCurrentPage(p => p + 1)}
                    />
                )}
            </DialogFooter>
        </DialogContent>
        </Dialog>
        <ReprintReceiptDialog
            isOpen={!!receiptBooking}
            onClose={() => setReceiptBooking(null)}
            payment={paymentForReceipt}
        />
        <CheckOutDialog
            isOpen={!!bookingToCheckout}
            onClose={() => setBookingToCheckout(null)}
            booking={bookingToCheckout}
            onCheckOut={handleCheckOut}
        />
    </>
  );
}
