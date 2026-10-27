
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { HeldSale } from '@/lib/types';
import { Trash2 } from 'lucide-react';

interface BulkDeleteHeldSalesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sales: HeldSale[];
  onConfirm: (salesToDelete: HeldSale[]) => Promise<void>;
}

export function BulkDeleteHeldSalesDialog({
  isOpen,
  onClose,
  sales,
  onConfirm,
}: BulkDeleteHeldSalesDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [confirmationText, setConfirmationText] = React.useState('');

  const handleDelete = async () => {
    if (sales.length === 0) return;
    setIsDeleting(true);
    try {
      await onConfirm(sales);
      onClose(); // Parent will show toast
    } catch (e) {
      // Errors handled by parent component's toast
    } finally {
      setIsDeleting(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) {
      setConfirmationText('');
    }
  }, [isOpen]);

  const CONFIRM_PHRASE = 'delete';
  const isConfirmationMatch = confirmationText.toLowerCase() === CONFIRM_PHRASE;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Bulk Deletion</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to delete <span className="font-bold">{sales.length}</span> running table(s). Items from these tables will be returned to stock. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4 space-y-4">
            <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="delete-confirmation">
                    To confirm, please type "<span className="font-semibold text-destructive">{CONFIRM_PHRASE}</span>" below.
                </Label>
                <Input
                    id="delete-confirmation"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    autoComplete="off"
                    disabled={isDeleting}
                    placeholder={`Type '${CONFIRM_PHRASE}' to confirm`}
                />
            </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            loading={isDeleting}
            disabled={isDeleting || !isConfirmationMatch || sales.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete {sales.length} Sale(s)
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
