
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
import type { Bill, BillItem } from '@/lib/types';
import { Trash2, Plus, Minus, Search, Undo2, AlertCircle } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';

interface ReturnItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  billItem: { bill: Bill; item: BillItem } | null;
  onConfirm: (bill: Bill, item: BillItem, quantity: number, reason: string) => void;
  isReturning: boolean;
  isPaid?: boolean;
}

export function ReturnItemDialog({
  isOpen,
  onClose,
  billItem,
  onConfirm,
  isReturning,
  isPaid = false,
}: ReturnItemDialogProps) {
  const [quantity, setQuantity] = React.useState(1);
  const [reason, setReason] = React.useState('');
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';

  React.useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setReason('');
    }
  }, [isOpen]);

  if (!billItem) return null;

  const { bill, item } = billItem;

  const handleConfirm = async () => {
    onConfirm(bill, item, quantity, reason);
  };

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity > 0 && newQuantity <= item.quantity) {
      setQuantity(newQuantity);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent onPointerDownOutside={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Return Item from Bill?</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to return <span className="font-bold">"{item.name}"</span>.
            This will credit the guest's bill and add the item back to stock if applicable.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
            {isPaid && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-sm font-medium">This bill has been paid. Items cannot be returned.</p>
              </div>
            )}
            <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">Currently on bill: {item.quantity}</p>
                </div>
                 <p className="font-semibold">{formatCurrency(item.price)} each</p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="return-quantity">Quantity to Return</Label>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleQuantityChange(quantity - 1)} disabled={quantity <= 1 || isPaid}>
                        <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                        id="return-quantity"
                        type="number"
                        value={quantity}
                        onChange={(e) => handleQuantityChange(parseInt(e.target.value))}
                        className="w-20 text-center"
                        max={item.quantity}
                        min={1}
                        disabled={isPaid}
                    />
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleQuantityChange(quantity + 1)} disabled={quantity >= item.quantity || isPaid}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="return-reason">Reason for Return (Optional)</Label>
                <Textarea
                    id="return-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Guest changed their mind, item was faulty."
                    disabled={isPaid}
                />
            </div>
            <p className="text-sm font-semibold text-destructive text-center">
                This will credit the bill by {formatCurrency(item.price * quantity)}.
            </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isReturning}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            loading={isReturning}
            disabled={isPaid}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Return {quantity} Item(s)
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
