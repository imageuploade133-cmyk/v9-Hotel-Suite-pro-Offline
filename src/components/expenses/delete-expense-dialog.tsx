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
import { doc, updateDoc } from 'firebase/firestore';
import type { Expense } from '@/lib/types';
import { format } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';

interface DeleteExpenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
  onSuccess: () => void;
}

export function DeleteExpenseDialog({ isOpen, onClose, expense, onSuccess }: DeleteExpenseDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (!firestore || !expense) return;

    setIsDeleting(true);
    try {
      const expenseRef = doc(firestore, 'expenses', expense.id);
      await updateDoc(expenseRef, { status: 'Voided' });
      toast({ variant: 'success', title: 'Expense Voided' });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!expense) return null;
  const date = getSafeDate(expense.date);

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will void the expense of <span className="font-bold">${expense.amount.toFixed(2)}</span> for{' '}
            <span className="font-bold">"{expense.description}"</span> recorded on{' '}
            <span className="font-bold">{date ? format(date, 'PPP') : 'N/A'}</span>.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={handleConfirm} loading={isDeleting}>
            Void Expense
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
