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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection } from '@/firebase';
import {
  doc,
  runTransaction,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import type { Booking, Room, Bill, Payment } from '@/lib/types';
import { ArrowRightLeft, AlertCircle, Receipt, CreditCard, AlertTriangle } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { formatCurrency } from '@/lib/helpers';
import { Separator } from '@/components/ui/separator';

const transferSchema = z.object({
  newRoomNumber: z.string().min(1, 'Please select a room'),
});

type TransferFormValues = z.infer<typeof transferSchema>;

interface TransferRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  rooms: Room[];
  onSuccess: () => void;
}

interface OutstandingBill {
  id: string;
  items: { name: string; price: number; quantity: number }[];
  total: number;
  paid: boolean;
}

export function TransferRoomDialog({
  isOpen,
  onClose,
  booking,
  rooms,
  onSuccess,
}: TransferRoomDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const [isSaving, setIsSaving] = React.useState(false);
  const [outstandingBills, setOutstandingBills] = React.useState<OutstandingBill[]>([]);
  const [billPayments, setBillPayments] = React.useState<Payment[]>([]);
  const [isLoadingBills, setIsLoadingBills] = React.useState(false);

  // Fetch all bookings to determine which rooms are truly vacant
  const bookingsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'bookings'));
  }, [firestore]);

  const { data: allBookings, isLoading: isLoadingBookings } = useCollection<Booking>(bookingsQuery, { realtime: true, cache: false });

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      newRoomNumber: '',
    },
  });

  // Fetch outstanding bills when dialog opens
  React.useEffect(() => {
    if (isOpen && booking && firestore) {
      fetchOutstandingBills();
      form.reset({ newRoomNumber: '' });
    } else {
      setOutstandingBills([]);
      setBillPayments([]);
    }
  }, [isOpen, booking, firestore]);

  const fetchOutstandingBills = async () => {
    if (!firestore || !booking) return;
    setIsLoadingBills(true);

    try {
      // Fetch bills for this booking
      const billsQuery = query(collection(firestore, `bookings/${booking.id}/bills`));
      const billsSnapshot = await getDocs(billsQuery);
      const bills: OutstandingBill[] = [];

      billsSnapshot.forEach((doc) => {
        const data = doc.data() as Bill;
        bills.push({
          id: doc.id,
          items: data.items || [],
          total: data.total || 0,
          paid: data.paid || false,
        });
      });

      setOutstandingBills(bills);

      // Fetch payments for this booking
      const paymentsQuery = query(
        collection(firestore, 'payments'),
        where('bookingId', '==', booking.id)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const payments: Payment[] = [];

      paymentsSnapshot.forEach((doc) => {
        payments.push({ id: doc.id, ...doc.data() } as Payment);
      });

      setBillPayments(payments);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setIsLoadingBills(false);
    }
  };

  // Calculate totals
  const { totalOutstanding, totalPaid, balanceDue, hasOutstandingBills } = React.useMemo(() => {
    const outstanding = outstandingBills.filter((bill) => !bill.paid);
    const totalOutstanding = outstanding.reduce((sum, bill) => sum + bill.total, 0);
    const totalPaid = billPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const balanceDue = totalOutstanding - totalPaid > 0 ? totalOutstanding - totalPaid : 0;

    return {
      totalOutstanding,
      totalPaid,
      balanceDue,
      hasOutstandingBills: outstanding.length > 0 && balanceDue > 0,
    };
  }, [outstandingBills, billPayments]);

  // Move these hooks BEFORE the conditional return
  const currentRoomType = React.useMemo(() => {
    if (!booking) return undefined;
    return rooms.find((r) => r.id === booking.roomId);
  }, [booking, rooms]);

  // Get all active/reserved booking room numbers to determine vacant rooms
  const occupiedRoomNumbers = React.useMemo(() => {
    if (!allBookings) return new Set<string>();
    return new Set(
      allBookings
        .filter(b =>
          b.roomNumber &&
          (b.status === 'Active' || b.status === 'Checked-in' || b.status === 'Reserved' || b.status === 'Booked')
        )
        .map(b => b.roomNumber)
    );
  }, [allBookings]);

  // Filter for vacant rooms of the same type (matching the same logic as useRoomStatus hook)
  const availableRooms = React.useMemo(() => {
    if (!booking || !currentRoomType || !currentRoomType.roomNumbers) return [];

    return currentRoomType.roomNumbers
      .filter(roomNumber => {
        // Can't transfer to the current room
        if (roomNumber === booking.roomNumber) return false;

        // Check if room is explicitly marked as Vacant in individualRoomStatus
        const explicitStatus = currentRoomType.individualRoomStatus?.[roomNumber];
        if (explicitStatus === 'Vacant') return true;

        // Check if room is NOT in an occupied state
        // Room is vacant if:
        // 1. Not explicitly marked as occupied (Active Check-ins)
        // 2. Not in active/reserved bookings
        // 3. Not explicitly marked as Maintenance or Do Not Disturb (these are staff-controlled)
        const isExplicitlyOccupied = explicitStatus === 'Active Check-ins' || explicitStatus === 'Reserved';
        const isInActiveBooking = occupiedRoomNumbers.has(roomNumber);
        const isStaffControlled = explicitStatus === 'Maintenance' || explicitStatus === 'Do Not Disturb' || explicitStatus === 'Cleaning in Progress';

        // Room is available if not explicitly occupied and not in active booking
        // We exclude staff-controlled statuses to be safe
        return !isExplicitlyOccupied && !isInActiveBooking && !isStaffControlled;
      })
      .sort((a, b) => {
        // Sort numerically (handles "1", "2", "10" correctly)
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        return numA - numB;
      });
  }, [currentRoomType, booking, occupiedRoomNumbers]);

  // Check if we're still loading bookings
  const isLoading = isLoadingBookings || isLoadingBills;

  // NOW we can do the conditional return - all hooks have been called
  if (!booking) return null;

  async function onSubmit(data: TransferFormValues) {
    if (!firestore || !booking || !booking.roomId || !booking.roomNumber) return;

    setIsSaving(true);
    try {
      await runTransaction(firestore, async (transaction) => {
        const roomRef = doc(firestore, 'rooms', booking.roomId!);
        const roomDoc = await transaction.get(roomRef);

        if (!roomDoc.exists()) {
          throw new Error('Room type not found.');
        }

        const roomData = roomDoc.data() as Room;
        const currentStatus = roomData.individualRoomStatus || {};

        // Verify new room is still vacant - check both explicit status and active bookings
        const explicitStatus = currentStatus[data.newRoomNumber];

        // Check if room has an active booking
        const activeBookingQuery = query(
          collection(firestore, 'bookings'),
          where('roomNumber', '==', data.newRoomNumber),
          where('status', 'in', ['Active', 'Checked-in', 'Reserved', 'Booked'])
        );
        const activeBookingSnapshot = await getDocs(activeBookingQuery);

        const hasActiveBooking = !activeBookingSnapshot.empty;

        if (explicitStatus !== 'Vacant' && !explicitStatus && hasActiveBooking) {
          throw new Error(`Room ${data.newRoomNumber} is no longer vacant.`);
        }

        if (explicitStatus === 'Active Check-ins' || explicitStatus === 'Reserved' || hasActiveBooking) {
          throw new Error(`Room ${data.newRoomNumber} is currently occupied or reserved.`);
        }

        // 1. Mark old room as "Cleaning in Progress" (auto-checkout)
        const updates: any = {
          [`individualRoomStatus.${data.newRoomNumber}`]: 'Occupied',
          [`individualRoomStatus.${booking.roomNumber!}`]: 'Cleaning in Progress',
        };

        transaction.update(roomRef, updates);

        // 2. Add old room to cleaning queue
        const cleaningQueueRef = doc(collection(firestore, 'cleaning-queue'));
        transaction.set(cleaningQueueRef, {
          roomId: booking.roomId,
          roomNumber: booking.roomNumber,
          lastGuestName: booking.guestName,
          lastGuestPhotoURL: booking.guestPhotoURL || null,
          bookingId: booking.id,
          checkedOutAt: serverTimestamp(),
          reason: 'Room Transfer',
          status: 'Pending',
        });

        // 3. Update booking with new room number
        const bookingRef = doc(firestore, 'bookings', booking.id);
        transaction.update(bookingRef, {
          roomNumber: data.newRoomNumber,
          updatedAt: serverTimestamp(),
        });

        // 4. Transfer outstanding bills to new room
        // (Bills are linked by bookingId, so they automatically follow the guest)
        // We just need to note the transfer in the bill for audit purposes
        const outstanding = outstandingBills.filter((bill) => !bill.paid);
        for (const bill of outstanding) {
          const billRef = doc(firestore, `bookings/${booking.id}/bills`, bill.id);
          transaction.update(billRef, {
            roomNumber: data.newRoomNumber,
            transferredFromRoom: booking.roomNumber,
            transferredAt: serverTimestamp(),
          });
        }
      });

      toast({
        variant: 'success',
        title: 'Transfer Successful',
        description: `Guest transferred from Room ${booking.roomNumber} to Room ${data.newRoomNumber}. Old room is now in cleaning queue.`,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Transfer error:', error);
      toast({
        variant: 'destructive',
        title: 'Transfer Failed',
        description: error.message || 'Could not complete the room transfer.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Transfer Guest</DialogTitle>
          <DialogDescription>
            Move {booking.guestName} to another room in {currentRoomType?.name || 'this category'}.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-4">
          {/* Outstanding Bills Summary */}
          <div className="bg-muted/30 rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Outstanding Bills</span>
            </div>

            {isLoadingBills ? (
              <div className="text-sm text-muted-foreground">Loading bills...</div>
            ) : outstandingBills.length > 0 ? (
              <div className="space-y-2">
                {/* Unpaid Bills List - with internal scroll for items */}
                {outstandingBills
                  .filter((bill) => !bill.paid)
                  .map((bill) => (
                    <div
                      key={bill.id}
                      className="space-y-2 border-b border-dashed last:border-0 pb-2 last:pb-0"
                    >
                      {/* Scrollable items container */}
                      <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                        {bill.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground truncate max-w-[180px]">
                              {item.quantity > 1 && (
                                <span className="font-medium text-foreground">
                                  {item.quantity}×{' '}
                                </span>
                              )}
                              {item.name}
                            </span>
                            <span className="font-medium text-destructive">
                              {formatCurrency(item.price * item.quantity, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {/* Bill total */}
                      <div className="flex items-center justify-between text-sm pt-1">
                        <span className="text-xs text-muted-foreground">Bill Total</span>
                        <span className="font-semibold text-destructive">
                          {formatCurrency(bill.total, currency)}
                        </span>
                      </div>
                    </div>
                  ))}

                {outstandingBills.filter((bill) => !bill.paid).length === 0 && (
                  <div className="text-sm text-green-600 flex items-center gap-1">
                    <CheckIcon className="h-3 w-3" />
                    All bills are paid
                  </div>
                )}

                <Separator />

                {/* Totals */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Outstanding</span>
                    <span className="font-semibold">{formatCurrency(totalOutstanding, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <CreditCard className="h-3 w-3" /> Total Paid
                    </span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(totalPaid, currency)}
                    </span>
                  </div>
                  {balanceDue > 0 && (
                    <div className="flex items-center justify-between text-sm pt-1">
                      <span className="text-muted-foreground font-medium">Balance Due</span>
                      <span className="font-bold text-destructive text-base">
                        {formatCurrency(balanceDue, currency)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No bills found for this booking.</div>
            )}
          </div>

          {/* Warning for outstanding bills */}
          {hasOutstandingBills && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <h5 className="font-medium leading-none tracking-tight text-orange-800 text-sm">
                    Outstanding Balance
                  </h5>
                  <div className="text-xs text-orange-700 dark:text-orange-400">
                    This room has an outstanding balance of{' '}
                    <strong>{formatCurrency(balanceDue, currency)}</strong>. This amount will be
                    transferred to the new room along with the guest.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form area */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Current Room</p>
                  <p className="text-lg font-bold">{booking.roomNumber}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Room Type</p>
                  <p className="text-sm font-medium truncate">{currentRoomType?.name || 'Unknown'}</p>
                </div>
              </div>

              <FormField
                control={form.control}
                name="newRoomNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Room</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoading ? "Loading available rooms..." : "Select a vacant room"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoading ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            Loading rooms...
                          </div>
                        ) : availableRooms.length > 0 ? (
                          availableRooms.map((roomNum) => (
                            <SelectItem key={roomNum} value={roomNum}>
                              Room {roomNum}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No vacant rooms available in this category.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Auto-checkout info */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-900">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                  <p className="font-medium">Auto Checkout</p>
                  <p>
                    The old room will automatically be marked as "Cleaning in Progress" and added to
                    the cleaning queue.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving || isLoading}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || isLoading || !form.formState.isValid || availableRooms.length === 0}
                  loading={isSaving}
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Transfer Guest
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simple check icon component
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
