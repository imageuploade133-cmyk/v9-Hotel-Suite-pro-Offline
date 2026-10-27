
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
import type { Customer } from '@/lib/types';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { useFirestore } from '@/firebase';
import { writeBatch, doc } from 'firebase/firestore';
import { Button } from '../ui/button';

interface BulkDeleteCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  onSuccess: () => void;
  collectionName?: 'customers' | 'pos-customers';
}

export function BulkDeleteCustomerDialog({ open, onOpenChange, customers, onSuccess, collectionName = 'customers' }: BulkDeleteCustomerDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [confirmationText, setConfirmationText] = React.useState('');

  const handleDelete = async () => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not remove profiles.' });
      return;
    }

    setIsDeleting(true);
    try {
      const batch = writeBatch(firestore);
      customers.forEach(customer => {
        const customerRef = doc(firestore, collectionName, customer.id);
        batch.delete(customerRef);
      });
      await batch.commit();

      toast({
        variant: 'success',
        title: 'Customer Profiles Removed',
        description: `${customers.length} customer profiles have been removed.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error removing customer profiles',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsDeleting(false);
      setConfirmationText('');
    }
  };

  const CONFIRM_PHRASE = 'Delete Profiles';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will permanently delete the profiles for{' '}
            <span className="font-bold">{customers.length}</span> selected customer(s).
            This action cannot be undone.
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
            loading={isDeleting}
            disabled={isDeleting || confirmationText !== CONFIRM_PHRASE}
            onClick={handleDelete}
          >
            Yes, remove profiles
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
