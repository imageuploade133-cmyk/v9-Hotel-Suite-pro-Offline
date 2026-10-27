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
import type { SalaryReward } from '@/lib/types';
import { Undo2 } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';

interface ReverseRewardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reward: SalaryReward | null | undefined;
  userId: string | null | undefined;
  onConfirm: (data: { reward: SalaryReward, userId: string }) => Promise<void>;
}

export function ReverseRewardDialog({
  isOpen,
  onClose,
  reward,
  userId,
  onConfirm,
}: ReverseRewardDialogProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';

  const handleConfirm = async () => {
    if (!reward || !userId) return;
    setIsProcessing(true);
    try {
      await onConfirm({ reward, userId });
      onClose();
    } catch (e) {
      // Parent component handles toasts
    } finally {
      setIsProcessing(false);
    }
  };

  if (!reward) return null;

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to cancel this reward?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the reward of{' '}
            <span className="font-bold">{formatCurrency(reward.amount)}</span> for{' '}
            <span className="font-bold">{reward.userName}</span>. This action cannot be undone.
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
            Yes, Cancel Reward
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
