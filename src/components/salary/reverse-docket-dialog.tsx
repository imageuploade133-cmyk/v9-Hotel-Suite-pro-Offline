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
import type { SalaryDeduction } from '@/lib/types';
import { Undo2 } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';

interface ReverseDocketDialogProps {
  isOpen: boolean;
  onClose: () => void;
  docket: SalaryDeduction | null;
  onConfirm: (docket: SalaryDeduction) => Promise<void>;
}

export function ReverseDocketDialog({
  isOpen,
  onClose,
  docket,
  onConfirm,
}: ReverseDocketDialogProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';


  const handleConfirm = async () => {
    if (!docket) return;
    setIsProcessing(true);
    try {
      await onConfirm(docket);
      onClose();
    } catch (e) {
        // Errors are handled in the parent component's toast
    } finally {
      setIsProcessing(false);
    }
  };

  if (!docket) return null;

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to reverse this deduction?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the deduction of{' '}
            <span className="font-bold">{formatCurrency(docket.amount)}</span> for{' '}
            <span className="font-bold">{docket.userName}</span>. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            loading={isProcessing}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Yes, Reverse Deduction
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
