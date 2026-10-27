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
import { DollarSign } from 'lucide-react';
import { Textarea } from '../ui/textarea';

interface DocketStaffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  staffData: StaffSalaryData | null;
  onConfirm: (staffList: StaffSalaryData[], customAmount: number, notes?: string) => Promise<void>;
}

export function DocketStaffDialog({
  isOpen,
  onClose,
  staffData,
  onConfirm,
}: DocketStaffDialogProps) {
  const { settings } = useSettings();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  React.useEffect(() => {
    if (staffData) {
      setAmount('');
      setNotes('');
    }
  }, [staffData]);

  const handleConfirm = async () => {
    if (!staffData) return;
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) return;

    setIsProcessing(true);
    try {
      await onConfirm([staffData], paymentAmount, notes);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  if (!staffData) return null;

  const currentRemaining = staffData.remainingSalary;
  const newBalanceAfterDeduction = currentRemaining - (parseFloat(amount) || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Salary Advance/Deduction</DialogTitle>
          <DialogDescription>
            Enter the amount to deduct from <span className="font-bold">{staffData.profile.name}</span>'s upcoming salary.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="p-4 rounded-lg border bg-muted">
            <p className="text-sm font-medium text-muted-foreground">Current Remaining Salary</p>
            <p className="text-3xl font-bold">{formatCurrency(currentRemaining)}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="docket-amount">Amount to Deduct</Label>
             <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    id="docket-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g., 500"
                    step="0.01"
                    className="pl-10 text-lg font-semibold"
                />
            </div>
             {newBalanceAfterDeduction < 0 && (
                <p className="text-xs text-destructive">This deduction exceeds the remaining salary.</p>
             )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="docket-notes">Notes (Optional)</Label>
            <Textarea
              id="docket-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Loan repayment, advance for personal reasons."
            />
          </div>
          <div className="p-4 rounded-lg border bg-muted">
            <div className="flex justify-between text-base font-bold">
                <span>New Remaining Salary:</span>
                <span className={newBalanceAfterDeduction < 0 ? 'text-destructive' : ''}>
                    {formatCurrency(newBalanceAfterDeduction)}
                </span>
            </div>
           </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isProcessing}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            loading={isProcessing}
            disabled={isProcessing || !amount || parseFloat(amount) <= 0}
          >
            Confirm Deduction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
