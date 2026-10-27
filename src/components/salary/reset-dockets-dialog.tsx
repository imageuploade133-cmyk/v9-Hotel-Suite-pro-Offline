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
import type { StaffSalaryData } from '@/app/(protected)/salary/page';
import { RefreshCw } from 'lucide-react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';

interface ResetDocketsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  staffData: StaffSalaryData | null;
  onConfirm: (staffData: StaffSalaryData) => Promise<void>;
}

export function ResetDocketsDialog({
  isOpen,
  onClose,
  staffData,
  onConfirm,
}: ResetDocketsDialogProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [confirmationText, setConfirmationText] = React.useState('');

  const handleConfirm = async () => {
    if (!staffData) return;
    setIsProcessing(true);
    try {
      await onConfirm(staffData);
      onClose();
    } catch (e) {
      // Parent component handles toasts
    } finally {
      setIsProcessing(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) {
      setConfirmationText('');
    }
  }, [isOpen]);

  if (!staffData) return null;

  const CONFIRM_PHRASE = 'YES RESET SALARY';
  const isConfirmationMatch = confirmationText === CONFIRM_PHRASE;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently reset all salary advances and deductions for{' '}
            <span className="font-bold">{staffData.profile.name}</span> for the current pay period.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
            <Label htmlFor="reset-confirmation">To confirm, please type "<span className="font-semibold text-destructive">{CONFIRM_PHRASE}</span>" below.</Label>
            <Input
                id="reset-confirmation"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                autoComplete="off"
                disabled={isProcessing}
                placeholder={`Type '${CONFIRM_PHRASE}' to confirm`}
            />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            loading={isProcessing}
            disabled={isProcessing || !isConfirmationMatch}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Yes, Reset
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
