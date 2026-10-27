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
import { doc, deleteDoc } from 'firebase/firestore';
import type { Customer } from '@/lib/types';
import { useBranch } from '@/contexts/branch-context';

interface DeleteCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  onSuccess: () => void;
  collectionName: 'customers' | 'pos-customers';
}

export function DeleteCustomerDialog({ open, onOpenChange, customer, onSuccess, collectionName }: DeleteCustomerDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { getCollectionPath } = useBranch();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!firestore || !customer) return;

    setIsDeleting(true);
    try {
      const collectionPath = getCollectionPath(collectionName);
      const customerRef = doc(firestore, collectionPath, customer.id);
      await deleteDoc(customerRef);

      toast({
        variant: 'success',
        title: 'Customer Deleted',
        description: `"${customer.name}" has been permanently deleted.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error deleting customer',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!customer) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the customer{' '}
            <span className="font-bold">{customer.name}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            loading={isDeleting}
          >
            Yes, delete customer
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
