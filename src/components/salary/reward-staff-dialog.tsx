'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { StaffSalaryData } from '@/app/(protected)/salary/page';
import { useSettings } from '@/contexts/settings-context';
import { DollarSign, Gift } from 'lucide-react';
import { Textarea } from '../ui/textarea';

interface RewardStaffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  staffData: StaffSalaryData | null;
  onConfirm: (staffData: StaffSalaryData, amount: number, notes: string) => Promise<void>;
}

export function RewardStaffDialog({
  isOpen,
  onClose,
  staffData,
  onConfirm,
}: RewardStaffDialogProps) {
  const { settings } = useSettings();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  React.useEffect(() => {
    if (isOpen) {
      setAmount('');
      setNotes('');
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!staffData) return;
    const rewardAmount = parseFloat(amount);
    if (isNaN(rewardAmount) || rewardAmount <= 0) return;

    setIsProcessing(true);
    try {
      await onConfirm(staffData, rewardAmount, notes);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  if (!staffData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="text-yellow-500 h-6 w-6" />
            Reward {staffData.profile.name}
          </DialogTitle>
          <DialogDescription>
            Give a bonus or reward to a staff member for exceptional performance. This will be recorded and they will be notified.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reward-amount">Reward Amount ({currency})</Label>
            <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    id="reward-amount"
                    type="number"
                    placeholder="e.g., 100.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-8"
                />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reward-notes">Reason for Reward</Label>
            <Textarea
              id="reward-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Exceeded monthly sales target, excellent guest feedback..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={isProcessing} disabled={isProcessing || !amount || parseFloat(amount) <= 0 || !notes}>
            <Gift className="mr-2 h-4 w-4" />
            Confirm Reward
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
