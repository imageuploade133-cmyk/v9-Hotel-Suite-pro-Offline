
'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, collection, getDocs, where, query, runTransaction, writeBatch, Timestamp } from 'firebase/firestore';
import type { Booking, Room, Bill } from '@/lib/types';
import { format, startOfDay, addDays, differenceInDays, isSameDay, isBefore, isValid } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { AlertCircle, DollarSign, Calendar, Info, ArrowRight, Clock, BedDouble } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { commitLocalFirstMutations, fetchLocalLanCollection } from '@/lib/lan-sync/sync-helper';
import { isLocalMasterHost } from '@/lib/lan-sync/is-local-master-host';

const renewSchema = z.object({
  newCheckInDate: z.date({ required_error: 'New check-in date is required' }),
  newCheckOutDate: z.date({ required_error: 'New check-out date is required' }),
  paymentMethod: z.string().optional(),
});

type RenewFormValues = z.infer<typeof renewSchema>;

interface ConflictingBooking {
  id: string;
  guestName: string;
  checkInDate: Date;
  checkOutDate: Date;
  status: string;
}

interface RenewBookingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  room?: Room;
  onSuccess: () => void;
  allBookings?: Booking[] | null;
  allBills?: Bill[] | null;
  isDataLoading?: boolean;
}

export function RenewBookingDialog({ isOpen, onClose, booking, room, onSuccess, allBookings, allBills, isDataLoading = false }: RenewBookingDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, userProfile } = useUser();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const paymentMethods = settings?.paymentMethods || [];
  const [isSaving, setIsSaving] = React.useState(false);
  const [conflictingBookings, setConflictingBookings] = React.useState<ConflictingBooking[]>([]);
  const [allOtherBookings, setAllOtherBookings] = React.useState<ConflictingBooking[]>([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = React.useState(false);
  const [conflictCheckError, setConflictCheckError] = React.useState(false);
  const [offlineValidationReady, setOfflineValidationReady] = React.useState(false);
  const [offlineOutstandingBills, setOfflineOutstandingBills] = React.useState<Bill[] | null>(null);

  const form = useForm<RenewFormValues>({
    resolver: zodResolver(renewSchema),
    mode: 'onChange',
  });

  const watchNewCheckIn = form.watch('newCheckInDate');
  const watchNewCheckOut = form.watch('newCheckOutDate');

  // Get initial dates from booking
  const originalCheckIn = React.useMemo(() => getSafeDate(booking?.checkInDate), [booking]);
  const originalCheckOut = React.useMemo(() => getSafeDate(booking?.checkOutDate), [booking]);

  // Resolve availability from Firestore online, or from the already-cached/LAN data offline.
  React.useEffect(() => {
    if (!isOpen || !booking?.roomNumber || !firestore) return;
    let cancelled = false;
    const toConflictRows = (rows: Booking[]) => rows
      .filter(candidate => candidate.id !== booking.id && candidate.roomNumber === booking.roomNumber
        && ['Booked', 'Reserved', 'Active', 'Checked-in'].includes(candidate.status))
      .map(candidate => ({
        id: candidate.id,
        guestName: candidate.guestName,
        checkInDate: getSafeDate(candidate.checkInDate),
        checkOutDate: getSafeDate(candidate.checkOutDate),
        status: candidate.status,
      }))
      .filter((candidate): candidate is ConflictingBooking => !!candidate.checkInDate && !!candidate.checkOutDate);
    const resolve = async () => {
      setIsCheckingConflicts(true);
      setConflictCheckError(false);
      setOfflineValidationReady(false);
      try {
        let rows: Booking[] | null = null;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          rows = Array.isArray(allBookings) ? allBookings : null;
          if (isLocalMasterHost()) {
            try {
              const localRows = await fetchLocalLanCollection<Booking>('bookings');
              rows = localRows;
            } catch {}
          }
        } else {
          try {
            const q = query(collection(firestore, 'bookings'), where('roomNumber', '==', booking.roomNumber), where('status', 'in', ['Booked', 'Reserved', 'Active', 'Checked-in']));
            const snapshot = await getDocs(q);
            rows = snapshot.docs.map(snapshotDoc => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as Booking));
          } catch {
            rows = Array.isArray(allBookings) ? allBookings : null;
            if (isLocalMasterHost()) {
              try {
                const localRows = await fetchLocalLanCollection<Booking>('bookings');
                rows = localRows;
              } catch {}
            }
          }
        }
        if (!rows) throw new Error('No cached booking schedule is available to verify this room.');
        const conflicts = toConflictRows(rows);
        if (!cancelled) {
          setAllOtherBookings(conflicts);
          setConflictCheckError(false);
          setOfflineValidationReady(true);
        }
      } catch (error) {
        console.error('[Renew Booking] Availability validation failed:', error);
        if (!cancelled) {
          setAllOtherBookings([]);
          setConflictCheckError(true);
          setOfflineValidationReady(false);
        }
      } finally {
        if (!cancelled) setIsCheckingConflicts(false);
      }
    };
    void resolve();
    return () => { cancelled = true; };
  }, [booking?.id, booking?.roomNumber, firestore, isOpen, allBookings, isDataLoading]);

  React.useEffect(() => {
    if (!isOpen || !booking) return;
    let cancelled = false;
    const resolveBills = async () => {
      let bills = Array.isArray(allBills) ? allBills.filter(bill => bill.bookingId === booking.id) : null;
      if ((typeof navigator !== 'undefined' && !navigator.onLine) || isLocalMasterHost()) {
        try {
          const localBills = await fetchLocalLanCollection<Bill>(`bookings/${booking.id}/bills`);
          if (isLocalMasterHost()) bills = localBills;
        } catch {}
      }
      if (!cancelled) setOfflineOutstandingBills(bills);
    };
    void resolveBills();
    return () => { cancelled = true; };
  }, [isOpen, booking?.id, allBills]);

  // Check for conflicts when dates change
  React.useEffect(() => {
    if (!watchNewCheckIn || !watchNewCheckOut || !allOtherBookings.length) {
      setConflictingBookings([]);
      return;
    }

    const conflicts = allOtherBookings.filter(other => {
      // Check if the new date range overlaps with any existing booking
      const newStart = startOfDay(watchNewCheckIn);
      const newEnd = startOfDay(watchNewCheckOut);
      const otherStart = startOfDay(other.checkInDate);
      const otherEnd = startOfDay(other.checkOutDate);

      // Overlap occurs when:
      // newStart < otherEnd AND newEnd > otherStart
      return newStart < otherEnd && newEnd > otherStart;
    });

    setConflictingBookings(conflicts);
  }, [watchNewCheckIn, watchNewCheckOut, allOtherBookings]);

  // Reset form when booking changes
  React.useEffect(() => {
    if (booking) {
      form.reset({
        newCheckInDate: originalCheckIn || undefined,
        newCheckOutDate: originalCheckOut || undefined,
        paymentMethod: '',
      });
      setConflictingBookings([]);
    }
  }, [booking, form, originalCheckIn, originalCheckOut]);

  // Calculate nights and cost
  const calculation = React.useMemo(() => {
    const checkIn = watchNewCheckIn;
    const checkOut = watchNewCheckOut;

    if (!checkIn || !checkOut || !isValid(checkIn) || !isValid(checkOut)) {
      return { nights: 0, totalCost: 0, isValid: false };
    }

    const nights = differenceInDays(startOfDay(checkOut), startOfDay(checkIn));
    const roomPrice = room?.price || 0;
    const totalCost = nights * roomPrice;

    const extensionNights = originalCheckOut ? Math.max(0, differenceInDays(startOfDay(checkOut), startOfDay(originalCheckOut))) : 0;
    const additionalCharge = extensionNights * roomPrice;
    return {
      nights,
      totalCost,
      extensionNights,
      additionalCharge,
      isValid: nights > 0 && !!originalCheckOut && extensionNights > 0,
    };
  }, [watchNewCheckIn, watchNewCheckOut, room?.price, originalCheckOut]);

  // Calculate date changes summary
  const dateChangesSummary = React.useMemo(() => {
    if (!originalCheckIn || !originalCheckOut || !watchNewCheckIn || !watchNewCheckOut) {
      return null;
    }

    const originalNights = differenceInDays(startOfDay(originalCheckOut), startOfDay(originalCheckIn));
    const newNights = calculation.nights;
    const costDifference = calculation.additionalCharge;

    return {
      originalNights,
      newNights,
      costDifference,
      checkInChanged: !isSameDay(originalCheckIn, watchNewCheckIn),
      checkOutChanged: !isSameDay(originalCheckOut, watchNewCheckOut),
    };
  }, [originalCheckIn, originalCheckOut, watchNewCheckIn, watchNewCheckOut, calculation, room?.price]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  async function onSubmit(data: RenewFormValues) {
    if (!firestore || !booking || !userProfile || !user) return;
    if (!calculation.isValid || !originalCheckOut) {
      toast({ variant: 'destructive', title: 'Invalid Date Range', description: 'The new check-out date must be later than the current check-out date.' });
      return;
    }
    if (conflictCheckError || isCheckingConflicts || !offlineValidationReady || conflictingBookings.length > 0) {
      toast({ variant: 'destructive', title: 'Room Availability Not Verified', description: conflictingBookings.length ? 'Another booking overlaps the requested extension.' : 'Refresh the room schedule before renewing. Renewal is blocked when availability cannot be verified.' });
      return;
    }
    if (!room?.price || !Number.isFinite(room.price) || room.price <= 0) {
      toast({ variant: 'destructive', title: 'Room Price Unavailable', description: 'A valid nightly room price is required to calculate the extension.' });
      return;
    }
    if (calculation.additionalCharge > 0 && !data.paymentMethod) {
      toast({ variant: 'destructive', title: 'Payment Method Required', description: 'Select the payment method collected for the additional renewal charge.' });
      return;
    }

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const requireBillsPaid = settings?.requireGuestBillsPaidBeforeRenewal === true;
    const now = new Date();
    const newCheckOut = startOfDay(data.newCheckOutDate);
    const renewalDateKey = format(newCheckOut, 'yyyyMMdd');
    const renewalCharge = calculation.additionalCharge;
    const renewalDescription = `Room renewal: ${calculation.extensionNights} additional night(s) through ${format(newCheckOut, 'MMM dd, yyyy')}`;
    const bookingRef = doc(firestore, 'bookings', booking.id);
    const roomRef = booking.roomId ? doc(firestore, 'rooms', booking.roomId) : null;
    if (!roomRef) {
      toast({ variant: 'destructive', title: 'Room Assignment Missing', description: 'This booking has no valid room assignment. Contact an administrator.' });
      return;
    }
    const paymentRef = doc(firestore, 'payments', `booking-renewal-${booking.id}-${renewalDateKey}`);
    const renewalBillRef = doc(firestore, `bookings/${booking.id}/bills`, `renewal-${renewalDateKey}`);
    const auditRef = doc(collection(firestore, 'globalAuditLog'));
    const actorName = userProfile.name || user.displayName || user.email || 'Unknown user';
    const billPaidAmount = (bill: Bill) => Number(bill.paidAmount) || (bill.paid ? Number(bill.total || 0) : 0);
    const getOutstanding = (bills: Bill[]) => bills.reduce((sum, bill) => sum + Math.max(0, Number(bill.total || 0) - billPaidAmount(bill)), 0);

    setIsSaving(true);
    try {
      if (requireBillsPaid && isOffline) {
        const cachedBills = offlineOutstandingBills;
        if (!cachedBills) throw new Error('Guest bills are not available in the offline cache. Reconnect or open the guest folio to synchronize bills before renewing.');
        const cachedOutstanding = getOutstanding(cachedBills);
        if (cachedOutstanding > 0.005) {
          throw new Error(`Renewal blocked by hotel policy. This guest has ${formatCurrency(cachedOutstanding)} in outstanding bills. Settle the old bills before renewing.`);
        }
      }

      const bookingUpdate = {
        checkOutDate: Timestamp.fromDate(newCheckOut),
        updatedAt: Timestamp.fromDate(now),
        updatedByUid: user.uid,
        updatedByName: actorName,
        lastRenewedAt: Timestamp.fromDate(now),
        lastRenewedByUid: user.uid,
        lastRenewedByName: actorName,
      };
      const billItem = {
        id: `renewal-${renewalBillRef.id}`,
        billId: renewalBillRef.id,
        name: renewalDescription,
        price: renewalCharge,
        quantity: 1,
        isService: true,
        paid: true,
        paymentId: paymentRef.id,
        printedQuantity: 0,
      };
      const renewalBillData = {
        id: renewalBillRef.id,
        bookingId: booking.id,
        items: [billItem],
        total: renewalCharge,
        paid: true,
        paidAmount: renewalCharge,
        paymentId: paymentRef.id,
        paymentMethod: data.paymentMethod,
        paidAt: Timestamp.fromDate(now),
        createdAt: Timestamp.fromDate(now),
        createdBy: user.uid,
        createdByName: actorName,
        renewal: true,
        description: renewalDescription,
      };
      const paymentData = {
        id: paymentRef.id,
        bookingId: booking.id,
        billId: renewalBillRef.id,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail || '',
        roomNumber: booking.roomNumber,
        amount: renewalCharge,
        paymentMethod: data.paymentMethod,
        status: 'Paid',
        transactionDate: Timestamp.fromDate(now),
        type: 'Additional Charges',
        createdByUid: user.uid,
        createdByName: actorName,
        items: [{ name: renewalDescription, price: renewalCharge, quantity: 1 }],
        notes: `Stay renewal for booking ${booking.id}. Existing guest bills remain separate and unchanged.`,
      };
      const auditData = {
        timestamp: Timestamp.fromDate(now),
        userId: user.uid,
        userName: actorName,
        userEmail: userProfile.email || user.email || '',
        userRole: userProfile.role || '',
        branchId: (userProfile as any).branchId || 'global',
        changeType: 'Update',
        action: 'Update',
        module: 'Bookings',
        entityType: 'Booking Renewal',
        entityId: booking.id,
        entityName: booking.guestName,
        collectionName: 'bookings',
        documentId: booking.id,
        status: 'Success',
        description: `Extended ${booking.guestName}'s stay in Room ${booking.roomNumber} to ${format(newCheckOut, 'MMM dd, yyyy')}`,
        details: { roomId: booking.roomId, roomNumber: booking.roomNumber, extensionNights: calculation.extensionNights, renewalCharge, paymentMethod: renewalCharge > 0 ? data.paymentMethod : null, renewalBillId: renewalCharge > 0 ? renewalBillRef.id : null, offlineQueued: isOffline },
        changes: [{ field: 'checkOutDate', before: originalCheckOut.toISOString(), after: newCheckOut.toISOString() }],
      };

      if (isOffline || isLocalMasterHost()) {
        // The LAN Master durably records the whole group locally before returning.
        // A browser without the LAN Master queues this atomic batch in Firestore's persistent IndexedDB cache.
        if (isOffline && !isLocalMasterHost() && requireBillsPaid && offlineOutstandingBills === null) {
          throw new Error('Cannot verify outstanding guest bills from the offline cache. Renewal has been stopped safely.');
        }
        const batch = writeBatch(firestore);
        batch.update(bookingRef, bookingUpdate);
        batch.update(roomRef, { [`individualRoomStatus.${booking.roomNumber}`]: 'Occupied' });
        if (renewalCharge > 0) {
          batch.set(renewalBillRef, renewalBillData);
          batch.set(paymentRef, paymentData);
        }
        batch.set(auditRef, auditData);
        const localMutations = [
          { collectionName: 'bookings', docId: booking.id, action: 'update' as const, data: { ...bookingUpdate, checkOutDate: newCheckOut.toISOString(), updatedAt: now.toISOString(), lastRenewedAt: now.toISOString() } },
          { collectionName: 'rooms', docId: booking.roomId, action: 'update' as const, data: { [`individualRoomStatus.${booking.roomNumber}`]: 'Occupied' } },
          ...(renewalCharge > 0 ? [
            { collectionName: `bookings/${booking.id}/bills`, docId: renewalBillRef.id, action: 'set' as const, data: { ...renewalBillData, createdAt: now.toISOString(), paidAt: now.toISOString() } },
            { collectionName: 'payments', docId: paymentRef.id, action: 'set' as const, data: { ...paymentData, transactionDate: now.toISOString() } },
          ] : []),
          { collectionName: 'globalAuditLog', docId: auditRef.id, action: 'set' as const, data: { ...auditData, timestamp: now.toISOString() } },
        ];
        if (isLocalMasterHost()) {
          await commitLocalFirstMutations(localMutations, `booking-renewal:${booking.id}:${renewalDateKey}`, () => batch.commit());
        } else {
          // Firestore persists the write batch locally and sends it when connectivity returns.
          void batch.commit().catch(error => console.error('[Renew Booking] Offline batch sync failed:', error));
        }
      } else {
        await runTransaction(firestore, async transaction => {
          const bookingSnapshot = await transaction.get(bookingRef);
          if (!bookingSnapshot.exists()) throw new Error('This booking no longer exists.');
          const currentBooking = bookingSnapshot.data() as Booking;
          const roomSnapshot = await transaction.get(roomRef);
          if (!roomSnapshot.exists()) throw new Error('The assigned room record no longer exists.');
          const currentCheckout = getSafeDate(currentBooking.checkOutDate);
          const currentCheckin = getSafeDate(currentBooking.checkInDate);
          if (!['Active', 'Checked-in'].includes(currentBooking.status)) throw new Error('Only a checked-in guest can renew this booking.');
          if (currentBooking.roomId !== booking.roomId || currentBooking.roomNumber !== booking.roomNumber) throw new Error('The room assignment changed. Refresh the booking.');
          if (!currentCheckout || !currentCheckin || !isSameDay(currentCheckin, data.newCheckInDate) || newCheckOut <= startOfDay(currentCheckout)) {
            throw new Error('The booking dates changed. Refresh the booking and retry.');
          }
          const roomBookingsQuery = query(collection(firestore, 'bookings'), where('roomNumber', '==', currentBooking.roomNumber), where('status', 'in', ['Booked', 'Reserved', 'Active', 'Checked-in']));
          const roomBookingsSnapshot = await transaction.get(roomBookingsQuery);
          const conflicts = roomBookingsSnapshot.docs.filter(snapshot => {
            if (snapshot.id === booking.id) return false;
            const other = snapshot.data();
            const otherStart = getSafeDate(other.checkInDate);
            const otherEnd = getSafeDate(other.checkOutDate);
            if (!otherStart || !otherEnd) return true;
            return startOfDay(otherStart) < newCheckOut && startOfDay(otherEnd) > startOfDay(data.newCheckInDate);
          });
          if (conflicts.length) throw new Error(`Renewal blocked: ${conflicts.length} overlapping booking(s) now exist for this room.`);

          const billsQuery = query(collection(firestore, `bookings/${booking.id}/bills`));
          const billsSnapshot = await transaction.get(billsQuery);
          const currentBills = billsSnapshot.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() } as Bill));
          const outstanding = getOutstanding(currentBills);
          if (requireBillsPaid && outstanding > 0.005) {
            throw new Error(`Renewal blocked by hotel policy. This guest has ${formatCurrency(outstanding)} in outstanding bills. Settle the old bills before renewing.`);
          }
          transaction.update(bookingRef, bookingUpdate);
          transaction.update(roomRef, { [`individualRoomStatus.${currentBooking.roomNumber}`]: 'Occupied' });
          if (renewalCharge > 0) {
            transaction.set(renewalBillRef, renewalBillData);
            transaction.set(paymentRef, paymentData);
          }
          transaction.set(auditRef, auditData);
        });
      }



      toast({
        variant: 'success',
        title: isOffline ? 'Renewal Saved Offline' : 'Booking Renewed Successfully',
        description: renewalCharge > 0
          ? `${booking.guestName}'s stay was extended. ${formatCurrency(renewalCharge)} was recorded in the guest folio. Existing unpaid bills were left unchanged.${isOffline ? ' The queued changes will sync when internet returns.' : ''}`
          : `${booking.guestName}'s stay was extended. No additional room charge was due.${isOffline ? ' The queued changes will sync when internet returns.' : ''}`,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Renewal Failed', description: error.message || 'Could not renew this booking.' });
    } finally {
      setIsSaving(false);
    }
  }

  const hasDateChanges = watchNewCheckIn && watchNewCheckOut && (dateChangesSummary?.checkInChanged || dateChangesSummary?.checkOutChanged);
  const canSubmit = form.formState.isValid && calculation.isValid && conflictingBookings.length === 0 && !conflictCheckError && offlineValidationReady && !isCheckingConflicts;

  if (!booking) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BedDouble className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Renew Booking</DialogTitle>
              <DialogDescription className="text-sm">
                Room {booking.roomNumber} • {booking.guestName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-6 py-2">
                {/* Guest Info Card */}
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border">
                  <Avatar className="h-12 w-12 border-2 border-background">
                    <AvatarImage src={booking.guestPhotoURL} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {getInitials(booking.guestName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{booking.guestName}</p>
                    <p className="text-sm text-muted-foreground">Current Stay: {originalCheckIn ? format(originalCheckIn, 'MMM dd') : 'N/A'} - {originalCheckOut ? format(originalCheckOut, 'MMM dd, yyyy') : 'N/A'}</p>
                  </div>
                  {room && (
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">{room.name}</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(room.price)}/night</p>
                    </div>
                  )}
                </div>

                {/* Date Selection Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">New Stay Dates</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* New Check-in Date */}
                    <FormField
                      control={form.control}
                      name="newCheckInDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>New Check-in Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  disabled
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "MMM dd, yyyy")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <Calendar className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={field.value}
                                onSelect={(date) => {
                                  field.onChange(date);
                                  // Clear check-out if it's before new check-in
                                  const currentCheckOut = form.getValues('newCheckOutDate');
                                  if (date && currentCheckOut && isBefore(startOfDay(currentCheckOut), startOfDay(date))) {
                                    form.setValue('newCheckOutDate', undefined);
                                  }
                                }}
                                disabled={(date) => !originalCheckIn || !isSameDay(date, originalCheckIn)}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* New Check-out Date */}
                    <FormField
                      control={form.control}
                      name="newCheckOutDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>New Check-out Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                  disabled={!watchNewCheckIn}
                                >
                                  {field.value ? (
                                    format(field.value, "MMM dd, yyyy")
                                  ) : (
                                    <span>{watchNewCheckIn ? "Original check-in date is fixed" : "Select check-in first"}</span>
                                  )}
                                  <Calendar className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={field.value}
                                onSelect={(date) => field.onChange(date)}
                                disabled={(date) => {
                                  // Disable dates before or on check-in date
                                  if (!watchNewCheckIn) return true;
                                  return isBefore(startOfDay(date), startOfDay(addDays(watchNewCheckIn, 1))) || (!!originalCheckOut && !isBefore(startOfDay(originalCheckOut), startOfDay(date)));
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Conflict Warnings */}
                {conflictCheckError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Availability check failed</AlertTitle><AlertDescription>Renewal is blocked until room availability can be verified. Check your connection and reopen the renewal dialog.</AlertDescription></Alert>}
                {conflictingBookings.length > 0 && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-900/20">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-red-800 dark:text-red-200">Booking Conflicts Detected</AlertTitle>
                    <AlertDescription className="text-red-700 dark:text-red-300">
                      <p className="mb-2">The following bookings overlap with your selected dates:</p>
                      <ul className="space-y-2 mt-2">
                        {conflictingBookings.map((conflict) => (
                          <li key={conflict.id} className="flex items-center gap-2 text-sm">
                            <span className="font-medium">{conflict.guestName}</span>
                            <span className="text-red-600/70 dark:text-red-400/70">
                              ({format(conflict.checkInDate, 'MMM dd')} - {format(conflict.checkOutDate, 'MMM dd')})
                            </span>
                            <Badge variant="secondary" className="text-xs">{conflict.status}</Badge>
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Cost Calculation */}
                {calculation.isValid && hasDateChanges && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Cost Calculation</h3>
                    </div>

                    <div className="space-y-3">
                      {/* Original Dates */}
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Original ({dateChangesSummary?.originalNights} nights)</span>
                        <span>{formatCurrency(dateChangesSummary?.originalNights! * (room?.price || 0))}</span>
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-primary">New Dates</span>
                      </div>

                      {/* New Dates */}
                      <div className="flex items-center justify-between text-sm">
                        <span>New ({calculation.nights} nights × {formatCurrency(room?.price || 0)})</span>
                        <span className="font-semibold">{formatCurrency(calculation.totalCost)}</span>
                      </div>

                      {dateChangesSummary && dateChangesSummary.costDifference !== 0 && (
                        <>
                          <Separator />
                          <div className="flex items-center justify-between">
                            <span className="text-sm">
                              Additional Payment Required
                            </span>
                            <span className={cn(
                              "font-bold text-lg",
                              "text-green-600"
                            )}>
                              {formatCurrency(Math.abs(dateChangesSummary.costDifference))}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Quick Info */}
                {calculation.isValid && (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {calculation.nights} Night{calculation.nights !== 1 ? 's' : ''}
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(watchNewCheckIn!, 'MMM dd')} - {format(watchNewCheckOut!, 'MMM dd')}
                    </Badge>
                    {dateChangesSummary?.checkInChanged && (
                      <Badge variant="outline" className="text-amber-600 border-amber-200">
                        Check-in Changed
                      </Badge>
                    )}
                    {dateChangesSummary?.checkOutChanged && (
                      <Badge variant="outline" className="text-blue-600 border-blue-200">
                        Check-out Changed
                      </Badge>
                    )}
                  </div>
                )}

                {calculation.isValid && calculation.additionalCharge > 0 && <Alert><Info className="h-4 w-4" /><AlertDescription>Additional renewal charge: <strong>{formatCurrency(calculation.additionalCharge)}</strong>. Only the additional nights are charged; the original room payment is preserved.</AlertDescription></Alert>}
                {/* Payment Method */}
                {calculation.isValid && calculation.additionalCharge > 0 && (
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Select payment method" />
                              </div>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {paymentMethods.map((method: string) => (
                              <SelectItem key={method} value={method}>{method}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* No Change Warning */}
                {watchNewCheckIn && watchNewCheckOut && !hasDateChanges && !conflictingBookings.length && (
                  <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                    <Info className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 dark:text-amber-300">
                      Dates are the same as current booking. No changes will be made.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="pt-4 mt-4 border-t flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || !canSubmit || !hasDateChanges || isCheckingConflicts || conflictCheckError}
                loading={isSaving}
                className="w-full sm:w-auto"
              >
                {isSaving ? 'Renewing...' : isCheckingConflicts ? 'Checking availability...' : 'Renew Booking'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
