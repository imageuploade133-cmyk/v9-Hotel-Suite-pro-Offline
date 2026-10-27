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
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import type { Room } from '@/lib/types';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';

interface BulkDeleteRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  onSuccess: () => void;
}

export function BulkDeleteRoomDialog({ open, onOpenChange, rooms, onSuccess }: BulkDeleteRoomDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [confirmationText, setConfirmationText] = React.useState('');

  const handleDelete = async () => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete rooms. Please try again.',
      });
      return;
    }

    setIsDeleting(true);
    try {
      const batch = writeBatch(firestore);
      rooms.forEach((room) => {
        const roomRef = doc(firestore, 'rooms', room.id);
        batch.delete(roomRef);
      });
      await batch.commit();

      toast({
        variant: 'success',
        title: 'Rooms Deleted',
        description: `${rooms.length} room(s) have been permanently deleted.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error deleting rooms',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsDeleting(false);
      setConfirmationText('');
    }
  };

  const CONFIRM_PHRASE = 'Delete Rooms';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete{' '}
            <span className="font-bold">{rooms.length}</span> selected room(s).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
            <Label htmlFor="delete-confirmation">To confirm, please type "<span className="font-semibold text-destructive">{CONFIRM_PHRASE}</span>" below.</Label>
            <Input
                id="delete-confirmation"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                autoComplete="off"
                disabled={isDeleting}
                placeholder={`Type '${CONFIRM_PHRASE}' to confirm`}
            />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting} onClick={() => setConfirmationText('')}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            loading={isDeleting}
            disabled={isDeleting || confirmationText !== CONFIRM_PHRASE}
          >
            Yes, delete rooms
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
