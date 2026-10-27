
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
import type { Booking } from '@/lib/types';
import { CircleX } from 'lucide-react';

interface CancelBookingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onConfirm: () => void;
  isCancelling: boolean;
}

export function CancelBookingDialog({
  isOpen,
  onClose,
  booking,
  onConfirm,
  isCancelling,
}: CancelBookingDialogProps) {

  if (!booking) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will cancel the reservation for{' '}
            <span className="font-bold">{booking.guestName}</span> in Room{' '}
            <span className="font-bold">{booking.roomNumber}</span>. This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCancelling}>Back</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={onConfirm}
            loading={isCancelling}
          >
            <CircleX className="mr-2 h-4 w-4" />
            Yes, Cancel Reservation
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
