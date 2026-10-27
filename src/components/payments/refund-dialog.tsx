
'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Payment, StockSale } from '@/lib/types';
import { Undo2, KeyRound } from 'lucide-react';
import { writeBatch, doc, increment, serverTimestamp, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { PagePermission } from '@/lib/permissions';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { usePermissions } from '@/hooks/use-permissions';

interface RefundDialogProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  onSuccess: () => void;
}

export function RefundDialog({
  isOpen,
  onClose,
  payment,
  onSuccess,
}: RefundDialogProps) {
  const { toast } = useToast();
  const [isRefunding, setIsRefunding] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [reason, setReason] = React.useState('');
  const firestore = useFirestore();
  const { user, userProfile } = useUser();
  const { settings } = useSettings();
  const { hasPermission } = usePermissions();
  const currency = settings?.currency || 'USD';

  // Check if this is a POS/Service payment (walk-in customer)
  const isPOSPayment = payment?.type === 'POS' || payment?.type === 'Service';

  React.useEffect(() => {
    if (isOpen) {
      setPassword('');
      setReason('');
    }
  }, [isOpen]);

  const handleRefund = async () => {
    if (!payment || !firestore || !user || !userProfile || !user.email) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Cannot process refund. User information is missing.',
      });
      return;
    }

    // Check if user has permission to process refunds
    if (!hasPermission(PagePermission.PROCESS_SALE_REFUNDS)) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'You do not have permission to process refunds. Please contact your administrator.',
      });
      return;
    }

    if (!password) {
      toast({
        variant: 'destructive',
        title: 'Password Required',
        description: 'Please enter your password to confirm the refund.',
      });
      return;
    }

    setIsRefunding(true);

    try {
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);

        const batch = writeBatch(firestore);

        // Handle booking-related refund
        if (payment.bookingDetails?.id) {
            const bookingRef = doc(firestore, 'bookings', payment.bookingDetails.id);
            batch.update(bookingRef, {
            status: 'Refunded',
            refundedAt: serverTimestamp(),
            cancelledAt: serverTimestamp(),
            cancelledByUid: user.uid,
            cancelledByName: userProfile.name,
            });

            if (payment.bookingDetails?.roomId && payment.roomNumber) {
                const roomRef = doc(firestore, 'rooms', payment.bookingDetails.roomId);
                batch.update(roomRef, {
                    availableRooms: increment(1),
                    bookedRooms: increment(-1),
                    [`individualRoomStatus.${payment.roomNumber}`]: 'Vacant',
                });
            }
        }

        // Handle POS/Service sale refund - restore stock
        if (isPOSPayment && payment.bookingId) {
            // Get the original sale to restore stock
            try {
                const saleDoc = await getDoc(doc(firestore, 'stockSales', payment.bookingId));
                if (saleDoc.exists()) {
                    const saleData = saleDoc.data() as StockSale;
                    // Restore stock for each item
                    for (const item of saleData.items || []) {
                        if (!item.isService) {
                            const stockRef = doc(firestore, 'stock', item.itemId);
                            batch.update(stockRef, { quantity: increment(item.quantity) });
                        }
                    }

                    // Update the sale status
                    const saleRef = doc(firestore, 'stockSales', payment.bookingId);
                    batch.update(saleRef, {
                        status: 'Refunded',
                        refundedAt: serverTimestamp(),
                        refundedByUid: user.uid,
                        refundedByName: userProfile.name,
                        refundReason: reason || null,
                    });
                }
            } catch (error) {
                console.error('Error fetching sale for refund:', error);
            }
        }

        // Update payment status with refund details
        const paymentRef = doc(firestore, 'payments', payment.id);
        const refundDetails = {
            amount: payment.amount,
            date: new Date(),
            reason: reason || null,
            processedByUid: user.uid,
            processedByName: userProfile.name,
        };
        batch.update(paymentRef, {
            status: 'Refunded',
            refundDetails,
        });

        await batch.commit();

        const customerType = isPOSPayment ? 'walk-in customer' : payment.guestName;
        toast({
            variant: 'success',
            title: 'Refund Processed',
            description: `Refund of ${formattedAmount} for ${customerType} has been processed.${isPOSPayment ? ' Stock has been restored.' : ''}`,
        });
        onSuccess();
        onClose();
    } catch (error: any) {
        let errorMessage = 'An unexpected error occurred.';
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password. Please try again.';
        }
      toast({
        variant: 'destructive',
        title: 'Error Processing Refund',
        description: errorMessage,
      });
    } finally {
      setIsRefunding(false);
    }
  };

  if (!payment) return null;

  const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(payment.amount);

  // Get the display name for the customer
  const displayName = payment.guestName || (isPOSPayment ? 'Walk-in Customer' : 'Unknown Customer');

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to issue a refund?</AlertDialogTitle>
          <AlertDialogDescription>
            This will process a refund for{' '}
            <span className="font-bold">{formattedAmount}</span>
            {isPOSPayment ? (
              <> for a POS sale to <span className="font-bold">{displayName}</span>.</>
            ) : (
              <> for the guest <span className="font-bold">{displayName}</span>.</>
            )}
            {isPOSPayment && ' Stock will be restored for the items.'}
            {!isPOSPayment && ' This will also mark the associated booking as \'Refunded\' and make the room available.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="password">Confirm Your Password</Label>
                <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password to confirm"
                        className="pl-10"
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="reason">Reason for Refund (Optional)</Label>
                <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for refund (optional)"
                    rows={2}
                />
            </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRefunding}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleRefund}
            loading={isRefunding}
            disabled={isRefunding || !password}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Yes, Issue Refund
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
