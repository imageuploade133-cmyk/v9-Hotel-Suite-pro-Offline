
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
import { LogIn, CircleDollarSign, CreditCard, BedDouble } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import type { Booking, Room } from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { Label } from '@/components/ui/label';

interface CheckInDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onCheckIn: (booking: Booking, paymentMethod?: string, amount?: number, roomNumber?: string) => Promise<void>;
  totalAmount?: number;
  availableRooms?: Room[];
}

export function CheckInDialog({
  isOpen,
  onClose,
  booking,
  onCheckIn,
  totalAmount,
  availableRooms,
}: CheckInDialogProps) {
  const { settings } = useSettings();
  const [isCheckingIn, setIsCheckingIn] = React.useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<string | undefined>();
  const [selectedRoomNumber, setSelectedRoomNumber] = React.useState<string | undefined>();
  const firestore = useFirestore();

  const paymentMethodsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paymentMethods'));
  }, [firestore]);
  const { data: paymentMethods } = useCollection(paymentMethodsQuery);

  const currency = settings?.currency || 'USD';
  const amount = totalAmount || booking?.amount || 0;

  const selectedRoomType = React.useMemo(() => {
    if (!booking || !availableRooms) return null;
    return availableRooms.find(r => r.id === booking.roomId);
  }, [booking, availableRooms]);

  const roomNumbersForType = React.useMemo(() => {
    if (!selectedRoomType || !selectedRoomType.roomNumbers) return [];

    // This assumes the parent component (useBookings hook) has already filtered out non-vacant rooms
    // For check-in, we should only be able to select from truly vacant rooms.
    const allNumbers = selectedRoomType.roomNumbers;
    const occupiedNumbers = Object.keys(selectedRoomType.individualRoomStatus || {});
    return allNumbers.filter(num => !occupiedNumbers.includes(num));

  }, [selectedRoomType]);


  React.useEffect(() => {
      if (isOpen) {
          setSelectedPaymentMethod(undefined);
          setSelectedRoomNumber(undefined);
          setIsCheckingIn(false);
      }
  }, [isOpen]);

  if (!booking) return null;

  const isPaidReservation = booking.status === 'Reserved';
  const needsRoomSelection = !booking.roomNumber || booking.roomNumber === 'N/A';

  const handleConfirm = async () => {
    setIsCheckingIn(true);
    try {
      if (isPaidReservation) {
        await onCheckIn(booking, undefined, undefined, selectedRoomNumber);
      } else {
        if (!selectedPaymentMethod) {
          setIsCheckingIn(false);
          return;
        }
        await onCheckIn(booking, selectedPaymentMethod, amount, selectedRoomNumber);
      }
    } catch (error) {
       console.error("Check-in failed:", error);
       setIsCheckingIn(false); // Re-enable on failure
    }
  };

  const canConfirm = isCheckingIn || (needsRoomSelection && !selectedRoomNumber) || (!isPaidReservation && !selectedPaymentMethod)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Check-in</DialogTitle>
          <DialogDescription>
            You are about to check in{' '}
            <span className="font-bold">{booking.guestName}</span>
            {booking.roomNumber && booking.roomNumber !== 'N/A' && ` for Room ${booking.roomNumber}`}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {needsRoomSelection && (
            <div className="space-y-2 p-4 border rounded-lg bg-background">
                <Label className="font-semibold">Assign Room</Label>
                 {availableRooms ? (
                    <Select onValueChange={setSelectedRoomNumber} value={selectedRoomNumber}>
                        <SelectTrigger>
                             <div className="flex items-center gap-2">
                                <BedDouble className="h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Select an available room number" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            {roomNumbersForType.length > 0 ? roomNumbersForType.map((num: string) => (
                                <SelectItem key={num} value={num}>Room {num}</SelectItem>
                            )) : (
                                <div className="p-4 text-center text-sm text-muted-foreground">No vacant rooms of this type.</div>
                            )}
                        </SelectContent>
                    </Select>
                 ) : (
                    <Skeleton className="h-10 w-full" />
                 )}
            </div>
          )}

          {isPaidReservation ? (
            <div className="py-4 text-center">
                <Badge variant="success" className="text-base px-4 py-2">
                <CircleDollarSign className="mr-2 h-5 w-5" />
                This is a pre-paid reservation.
                </Badge>
                <p className="mt-2 text-sm text-muted-foreground">
                No payment is required at this time.
                </p>
            </div>
          ) : (
             <div className="space-y-4">
                <h3 className="mb-4 text-lg font-semibold text-center">
                Collect Payment: {new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount)}
                </h3>
                <Select onValueChange={setSelectedPaymentMethod} value={selectedPaymentMethod} disabled={isCheckingIn}>
                    <SelectTrigger>
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder="Select a payment method" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        {paymentMethods?.map((method: any) => (
                            <SelectItem key={method.id} value={method.name}>
                                {method.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isCheckingIn}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={canConfirm} loading={isCheckingIn}>
            <LogIn className="mr-2 h-4 w-4" />
            Confirm Check-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
