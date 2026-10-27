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
import { CircleDollarSign, CreditCard } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import type { Customer, Payment } from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/user-context';
import { Separator } from '../ui/separator';

interface PayCreditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  outstandingBalance: number;
  onSuccess: (data: { payment: Payment; customer: Customer; balance: number }) => void;
}

export function PayCreditDialog({ isOpen, onClose, customer, outstandingBalance, onSuccess }: PayCreditDialogProps) {
  const { settings } = useSettings();
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<string | undefined>();
  const [amountToPay, setAmountToPay] = React.useState<string>('');

  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { toast } = useToast();

  const paymentMethodsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paymentMethods'));
  }, [firestore]);
  const { data: paymentMethods } = useCollection(paymentMethodsQuery);

  const currency = settings?.currency || 'USD';

  React.useEffect(() => {
    if (isOpen) {
      setAmountToPay(outstandingBalance.toString());
      setSelectedPaymentMethod(undefined);
      setIsSaving(false);
    }
  }, [isOpen, outstandingBalance]);

  const handleConfirm = async () => {
    if (!customer || !selectedPaymentMethod || !firestore || !userProfile) return;

    const paymentAmount = parseFloat(amountToPay);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid amount to pay.' });
      return;
    }

    if (paymentAmount > outstandingBalance) {
      toast({ variant: 'destructive', title: 'Amount Too High', description: `You cannot pay more than the outstanding balance of ${formatCurrency(outstandingBalance)}.` });
      return;
    }

    setIsSaving(true);
    try {
      const paymentRef = doc(collection(firestore, 'payments'));
      const paymentData: Omit<Payment, 'id'> = {
        guestName: customer.name,
        guestEmail: customer.email,
        amount: paymentAmount,
        paymentMethod: selectedPaymentMethod,
        status: 'Paid',
        transactionDate: new Date(),
        type: 'Credit Repayment',
        createdByUid: userProfile.uid,
        createdByName: userProfile.name,
      };

      await setDoc(paymentRef, paymentData);

      toast({ variant: 'success', title: 'Payment Successful', description: `Payment of ${formatCurrency(paymentAmount)} has been recorded.` });

      const newBalance = outstandingBalance - paymentAmount;
      onSuccess({ payment: { id: paymentRef.id, ...paymentData } as Payment, customer, balance: newBalance });
      onClose();

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Payment Failed', description: error.message || 'An unexpected error occurred.' });
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  const paymentAmountNumber = parseFloat(amountToPay) || 0;
  const newBalance = outstandingBalance - paymentAmountNumber;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay Outstanding Credit</DialogTitle>
          <DialogDescription>
            Settle the balance for <span className="font-bold">{customer.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="p-4 rounded-lg border bg-muted">
            <p className="text-sm font-medium text-muted-foreground">Current Outstanding Balance</p>
            <p className="text-3xl font-bold text-destructive">{formatCurrency(outstandingBalance)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount-to-pay">Amount to Pay</Label>
            <Input
              id="amount-to-pay"
              type="number"
              value={amountToPay}
              onChange={(e) => setAmountToPay(e.target.value)}
              placeholder="Enter amount"
              step="0.01"
            />
          </div>

          <Select onValueChange={setSelectedPaymentMethod} value={selectedPaymentMethod} disabled={isSaving}>
            <SelectTrigger>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Select a payment method" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {(paymentMethods as any[])?.map((method: any) => (
                <SelectItem key={method.id} value={method.name}>
                  {method.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
           <Separator />
           <div className="p-4 rounded-lg border bg-muted space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Payment:</span>
                <span className="font-medium">{formatCurrency(paymentAmountNumber)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
                <span>New Balance:</span>
                <span className={newBalance < 0 ? 'text-destructive' : ''}>{formatCurrency(newBalance)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isSaving || !selectedPaymentMethod || !amountToPay || parseFloat(amountToPay) <= 0} loading={isSaving}>
            <CircleDollarSign className="mr-2 h-4 w-4" />
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
