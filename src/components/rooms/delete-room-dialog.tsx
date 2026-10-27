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
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import type { Room, Booking } from '@/lib/types';

interface DeleteRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
  onSuccess: () => void;
}

export function DeleteRoomDialog({ open, onOpenChange, room, onSuccess }: DeleteRoomDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!firestore || !room) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete room. Please try again.',
      });
      return;
    }

    setIsDeleting(true);
    try {
      const batch = writeBatch(firestore);

      // 1. Find all active bookings for this room type
      const bookingsQuery = query(
        collection(firestore, 'bookings'),
        where('roomId', '==', room.id),
        where('status', 'in', ['Active', 'Checked-in'])
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);

      // 2. For each booking, find and delete its bills subcollection
      for (const bookingDoc of bookingsSnapshot.docs) {
        const bookingData = bookingDoc.data() as Booking;
        const billsQuery = query(collection(firestore, `bookings/${bookingData.id}/bills`));
        const billsSnapshot = await getDocs(billsQuery);
        billsSnapshot.forEach(billDoc => {
          batch.delete(billDoc.ref);
        });
        // 3. Delete the booking itself
        batch.delete(bookingDoc.ref);
      }

      // 4. Delete the room itself
      const roomRef = doc(firestore, 'rooms', room.id);
      batch.delete(roomRef);

      await batch.commit();

      toast({
        variant: 'success',
        title: 'Room and Active Bookings Deleted',
        description: `The room "${room.name}" and all of its active check-ins have been permanently deleted.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error deleting room',
        description: error.message || 'An unexpected error occurred. Ensure no bookings are associated with this room.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the room{' '}
            <span className="font-bold">{room.name}</span> and all of its current active check-ins.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            loading={isDeleting}
          >
            Yes, delete room
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
