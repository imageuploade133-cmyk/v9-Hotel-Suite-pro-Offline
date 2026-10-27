'use client';

import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import type { Booking } from '@/lib/types';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { useUser } from '@/contexts/user-context';

interface CheckOutDialogProps {
  isOpen: boolean;
  booking?: Booking | null;
  onClose: () => void;
  onCheckOut: (booking: Booking, staffName: string, notes?: string) => Promise<void>;
}

export function CheckOutDialog({
  isOpen,
  booking,
  onClose,
  onCheckOut,
}: CheckOutDialogProps) {
  const [notes, setNotes] = useState('');
  const { userProfile } = useUser();
  const [staffName, setStaffName] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setNotes('');
      setIsCheckingOut(false);
      setStaffName(userProfile?.name || '');
    }
  }, [isOpen, userProfile]);

  const handleConfirm = async () => {
    if (!booking) return;
     if (!staffName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Staff Name Required',
        description: 'Please enter the name of the staff member processing the checkout.',
      });
      return;
    }
    setIsCheckingOut(true);
    try {
        await onCheckOut(booking, staffName, notes);
        onClose(); // Close on success
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Something went wrong during check-out.',
        });
        setIsCheckingOut(false); // Re-enable on failure
    }
  };

  if (!booking) return null;

  const guestName = booking.guestName;
  const roomNumber = booking.roomNumber;


  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Check-Out</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to check out {guestName ? <span className="font-bold">{guestName}</span> : 'the guest'} from Room{' '}
            <span className="font-bold">{roomNumber}</span>? The room status will be set to "Cleaning in Progress".
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="staff-name">By</Label>
            <Input
              id="staff-name"
              placeholder="Staff name..."
              value={staffName}
              onChange={e => setStaffName(e.target.value)}
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="checkout-notes">Checkout Notes (Optional)</Label>
            <Textarea
              id="checkout-notes"
              placeholder="e.g., Guest left early, room was left in excellent condition."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={isCheckingOut}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCheckingOut}>Cancel</AlertDialogCancel>
          <Button onClick={handleConfirm} loading={isCheckingOut} disabled={!staffName.trim()}>
            Confirm Check-Out
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
