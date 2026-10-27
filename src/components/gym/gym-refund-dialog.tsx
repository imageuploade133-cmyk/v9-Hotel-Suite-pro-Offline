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
import type { Payment } from '@/lib/types';
import { Undo2 } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';

interface GymRefundDialogProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  onConfirm: (payment: Payment) => void;
}

export function GymRefundDialog({
  isOpen,
  onClose,
  payment,
  onConfirm,
}: GymRefundDialogProps) {
  const [isRefunding, setIsRefunding] = React.useState(false);
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';


  const handleConfirm = async () => {
    if (!payment) return;
    setIsRefunding(true);
    try {
      await onConfirm(payment);
      // Parent component will handle success toast and closing
    } catch (e) {
      // Parent component will handle error toast
    } finally {
      setIsRefunding(false);
    }
  };

  if (!payment) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to issue a refund?</AlertDialogTitle>
          <AlertDialogDescription>
            This will process a refund for{' '}
            <span className="font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(payment.amount)}</span> for the guest{' '}
            <span className="font-bold">{payment.guestName}</span>. This will also mark the associated membership as 'Refunded' and expired. This action is for demonstration and does not process real money.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRefunding}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            loading={isRefunding}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Yes, Issue Refund
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
