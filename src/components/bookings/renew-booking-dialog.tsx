
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
import { doc, updateDoc, Timestamp, collection, getDocs, where, query, writeBatch, deleteField, QuerySnapshot, DocumentData } from 'firebase/firestore';
import type { Booking, Room, Payment } from '@/lib/types';
import { format, startOfDay, addDays, differenceInDays, isSameDay, isBefore, isAfter, isValid } from 'date-fns';
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

const renewSchema = z.object({
  newCheckInDate: z.date({ required_error: 'New check-in date is required' }),
  newCheckOutDate: z.date({ required_error: 'New check-out date is required' }),
  paymentMethod: z.string().min(1, 'Payment method is required.'),
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
}

export function RenewBookingDialog({ isOpen, onClose, booking, room, onSuccess }: RenewBookingDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const paymentMethods = settings?.paymentMethods || [];
  const [isSaving, setIsSaving] = React.useState(false);
  const [conflictingBookings, setConflictingBookings] = React.useState<ConflictingBooking[]>([]);
  const [allOtherBookings, setAllOtherBookings] = React.useState<ConflictingBooking[]>([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = React.useState(false);

  const form = useForm<RenewFormValues>({
    resolver: zodResolver(renewSchema),
    mode: 'onChange',
  });

  const watchNewCheckIn = form.watch('newCheckInDate');
  const watchNewCheckOut = form.watch('newCheckOutDate');

  // Get initial dates from booking
  const originalCheckIn = React.useMemo(() => getSafeDate(booking?.checkInDate), [booking]);
  const originalCheckOut = React.useMemo(() => getSafeDate(booking?.checkOutDate), [booking]);

  // Fetch all bookings for this room to check for conflicts
  React.useEffect(() => {
    if (isOpen && booking?.roomNumber && firestore) {
      const fetchBookings = async () => {
        setIsCheckingConflicts(true);
        try {
          const q = query(
            collection(firestore, 'bookings'),
            where('roomNumber', '==', booking.roomNumber),
            where('id', '!=', booking.id),
            where('status', 'in', ['Booked', 'Reserved', 'Active', 'Checked-in'])
          );

          const querySnapshot = await getDocs(q);
          const otherBookings: ConflictingBooking[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              guestName: data.guestName,
              checkInDate: getSafeDate(data.checkInDate)!,
              checkOutDate: getSafeDate(data.checkOutDate)!,
              status: data.status,
            };
          }).filter(b => b.checkInDate && b.checkOutDate);

          setAllOtherBookings(otherBookings);
        } catch (error) {
          console.error('Error fetching bookings:', error);
        } finally {
          setIsCheckingConflicts(false);
        }
      };
      fetchBookings();
    }
  }, [booking, firestore, isOpen]);

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

    return {
      nights,
      totalCost,
      isValid: nights > 0,
    };
  }, [watchNewCheckIn, watchNewCheckOut, room?.price]);

  // Calculate date changes summary
  const dateChangesSummary = React.useMemo(() => {
    if (!originalCheckIn || !originalCheckOut || !watchNewCheckIn || !watchNewCheckOut) {
      return null;
    }

    const originalNights = differenceInDays(startOfDay(originalCheckOut), startOfDay(originalCheckIn));
    const newNights = calculation.nights;
    const nightDifference = newNights - originalNights;
    const costDifference = calculation.totalCost - (originalNights * (room?.price || 0));

    return {
      originalNights,
      newNights,
      nightDifference,
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
    if (!firestore || !booking || !userProfile) return;

    // Validate dates
    if (!calculation.isValid) {
      toast({
        variant: 'destructive',
        title: 'Invalid Date Range',
        description: 'Check-out date must be after check-in date.',
      });
      return;
    }

    // Check for conflicts
    if (conflictingBookings.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Booking Conflict',
        description: `There ${conflictingBookings.length === 1 ? 'is' : 'are'} ${conflictingBookings.length} conflicting booking${conflictingBookings.length === 1 ? '' : 's'} for this room during the selected dates.`,
      });
      return;
    }

    // Validate room price
    if (!room?.price || room.price <= 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Room price is not available. Cannot calculate renewal cost.',
      });
      return;
    }

    // Validate payment method if there's a charge
    if (calculation.totalCost > 0 && !data.paymentMethod) {
      toast({
        variant: 'destructive',
        title: 'Payment Method Required',
        description: 'Please select a payment method for the renewal.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);

      // Update booking document
      const bookingRef = doc(firestore, 'bookings', booking.id);
      const updateData: Partial<Booking> = {
        checkInDate: Timestamp.fromDate(data.newCheckInDate),
        checkOutDate: Timestamp.fromDate(data.newCheckOutDate),
        totalAmount: calculation.totalCost,
        status: 'Checked-in',
        actualCheckOutDate: deleteField(),
        updatedAt: Timestamp.fromDate(new Date()),
        updatedByUid: userProfile.uid,
        updatedByName: userProfile.name,
      };
      batch.update(bookingRef, updateData);

      // Update Room Status to Occupied
      if (booking.roomId && booking.roomNumber) {
        const roomRef = doc(firestore, 'rooms', booking.roomId);
        batch.update(roomRef, {
          [`individualRoomStatus.${booking.roomNumber}`]: 'Occupied'
        });
      }

      // Create payment record
      const paymentRef = doc(collection(firestore, 'payments'));
      const sanitizedBooking: Partial<Booking> = {
        ...booking,
        checkInDate: data.newCheckInDate,
        checkOutDate: data.newCheckOutDate,
        actualCheckOutDate: null,
        status: 'Checked-in',
        totalAmount: calculation.totalCost,
      };

      const paymentData: Partial<Payment> = {
        id: paymentRef.id,
        bookingId: booking.id,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        roomNumber: booking.roomNumber,
        amount: calculation.totalCost,
        paymentMethod: data.paymentMethod,
        status: 'Paid',
        transactionDate: new Date(),
        type: 'Booking',
        createdByUid: userProfile.uid,
        createdByName: userProfile.name,
        bookingDetails: sanitizedBooking,
        notes: `Booking renewed from ${format(originalCheckIn!, 'MMM dd, yyyy')} - ${format(originalCheckOut!, 'MMM dd, yyyy')} to ${format(data.newCheckInDate, 'MMM dd, yyyy')} - ${format(data.newCheckOutDate, 'MMM dd, yyyy')}`,
      };
      batch.set(paymentRef, paymentData);

      await batch.commit();

      toast({
        variant: 'success',
        title: 'Booking Renewed Successfully',
        description: `${booking.guestName}'s stay has been renewed to ${format(data.newCheckOutDate, 'MMM dd, yyyy')}.`,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Renewal Failed',
        description: error.message || 'An unexpected error occurred while renewing the booking.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  const hasDateChanges = watchNewCheckIn && watchNewCheckOut && (dateChangesSummary?.checkInChanged || dateChangesSummary?.checkOutChanged);
  const canSubmit = form.formState.isValid && calculation.isValid && conflictingBookings.length === 0;

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
                    <p className="text-sm text-muted-foreground">Current Stay: {format(originalCheckIn!, 'MMM dd')} - {format(originalCheckOut!, 'MMM dd, yyyy')}</p>
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
                                disabled={(date) => {
                                  // Disable dates in the past (before today)
                                  return isBefore(startOfDay(date), startOfDay(new Date()));
                                }}
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
                                    <span>{watchNewCheckIn ? "Pick a date" : "Select check-in first"}</span>
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
                                  return isBefore(startOfDay(date), startOfDay(addDays(watchNewCheckIn, 1)));
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
                              {dateChangesSummary.costDifference > 0 ? 'Additional Payment Required' : 'Refund Due'}
                            </span>
                            <span className={cn(
                              "font-bold text-lg",
                              dateChangesSummary.costDifference > 0 ? "text-green-600" : "text-amber-600"
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

                {/* Payment Method */}
                {calculation.isValid && calculation.totalCost > 0 && (
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
                disabled={isSaving || !canSubmit || !hasDateChanges}
                loading={isSaving}
                className="w-full sm:w-auto"
              >
                {isSaving ? 'Renewing...' : 'Renew Booking'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
