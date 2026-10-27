
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
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Repeat } from 'lucide-react';
import { Separator } from '../ui/separator';
import { useSettings } from '@/contexts/settings-context';

interface TransferFundsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accountBalances: Map<string, number>;
}

export function TransferFundsDialog({
  isOpen,
  onClose,
  onSuccess,
  accountBalances,
}: TransferFundsDialogProps) {
  const [fromAccount, setFromAccount] = React.useState<string | undefined>();
  const [toAccount, setToAccount] = React.useState<string | undefined>();
  const [amount, setAmount] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { toast } = useToast();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';

  const formatCurrency = (value: number | undefined) => {
      if(value === undefined) return 'N/A';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  }

  const fromBalance = fromAccount ? accountBalances.get(fromAccount) : undefined;
  const toBalance = toAccount ? accountBalances.get(toAccount) : undefined;
  const amountNumber = parseFloat(amount) || 0;

  const newFromBalance = fromBalance !== undefined ? fromBalance - amountNumber : undefined;
  const newToBalance = toBalance !== undefined ? toBalance + amountNumber : undefined;

  const handleConfirm = async () => {
    if (!firestore || !userProfile || !fromAccount || !toAccount || !amount) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill all required fields.' });
      return;
    }
    if (fromAccount === toAccount) {
        toast({ variant: 'destructive', title: 'Error', description: 'Cannot transfer to the same account.' });
        return;
    }
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount' });
      return;
    }

    if(fromBalance !== undefined && transferAmount > fromBalance) {
        toast({ variant: 'destructive', title: 'Insufficient Funds', description: `The amount exceeds the balance in the ${fromAccount} account.` });
        return;
    }

    setIsSaving(true);
    try {
        const transferRef = doc(collection(firestore, 'transfers'));
        await addDoc(collection(firestore, 'transfers'), {
            fromAccount,
            toAccount,
            amount: transferAmount,
            notes,
            transferredAt: serverTimestamp(),
            transferredByUid: userProfile.uid,
            transferredByName: userProfile.name,
            transferId: transferRef.id,
            beforeBalances: { from: fromBalance, to: toBalance },
            afterBalances: { from: newFromBalance, to: newToBalance },
        });

      toast({ variant: 'success', title: 'Transfer Successful' });
      onSuccess();
      onClose();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Funds</DialogTitle>
          <DialogDescription>Move funds between your payment accounts.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label>From Account</Label>
                <Select value={fromAccount} onValueChange={setFromAccount}>
                    <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                    <SelectContent>
                        {Array.from(accountBalances.keys()).map(method => (
                            <SelectItem key={method} value={method}>{method} ({formatCurrency(accountBalances.get(method))})</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-2">
                <Label>To Account</Label>
                <Select value={toAccount} onValueChange={setToAccount}>
                    <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                    <SelectContent>
                        {Array.from(accountBalances.keys()).map(method => (
                            <SelectItem key={method} value={method}>{method} ({formatCurrency(accountBalances.get(method))})</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transfer-amount">Amount to Transfer</Label>
            <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="transfer-amount" type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="pl-8"/>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transfer-notes">Notes (Optional)</Label>
            <Input id="transfer-notes" placeholder="e.g., Cash deposit to bank" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          {fromAccount && toAccount && (
            <div className="p-4 rounded-lg border bg-muted/50 text-sm space-y-2">
                <div className="flex justify-between"><span>{fromAccount} New Balance:</span><span className="font-semibold">{formatCurrency(newFromBalance)}</span></div>
                <div className="flex justify-between"><span>{toAccount} New Balance:</span><span className="font-semibold">{formatCurrency(newToBalance)}</span></div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleConfirm} loading={isSaving} disabled={!fromAccount || !toAccount || !amount || parseFloat(amount) <= 0}>
            <Repeat className="mr-2 h-4 w-4" />
            Confirm Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
