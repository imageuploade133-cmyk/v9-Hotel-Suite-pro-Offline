
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
import { Hand, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Customer } from '@/lib/types';

interface HoldSaleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, clearCartOnSuccess: boolean) => Promise<void>;
  isProcessing: boolean;
  customer: (Partial<Customer> & { outstandingBalance?: number }) | null;
  isUpdate?: boolean;
}

export function HoldSaleDialog({ isOpen, onClose, onConfirm, isProcessing, customer, isUpdate }: HoldSaleDialogProps) {
  const { toast } = useToast();

  const customerName = customer?.name;

  const handleConfirm = (clearCart: boolean) => {
    if (!customerName || customerName === 'Walk-in Customer') {
        toast({
            variant: 'destructive',
            title: 'Table Name Required',
            description: 'Please enter a name for the table before adding to running tables.',
        });
        return;
    }
    onConfirm(customerName, clearCart);
  };

  const isGenericWalkIn = !isUpdate && (!customerName || customerName === 'Walk-in Customer');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isUpdate ? 'Update Running Table' : 'Add to Running Table'}</DialogTitle>
          <DialogDescription>
            {isUpdate
              ? `This will update the running table for "${customerName}".`
              : 'This will save the current cart.'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            {isGenericWalkIn ? (
                <p className="text-sm text-center text-muted-foreground p-4 bg-muted rounded-md">
                    To add to running tables, please enter a name or identifier (like "Table 5") in the customer panel first.
                </p>
            ) : (
                <div className="space-y-2">
                    <Label>Table Name:</Label>
                    <p className="text-lg font-semibold p-2 border rounded-md bg-muted/50">{customerName}</p>
                </div>
            )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          {isUpdate ? (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={() => handleConfirm(false)} disabled={isProcessing || isGenericWalkIn} loading={isProcessing}>
                <Save className="mr-2 h-4 w-4" />
                Update Only
              </Button>
              <Button onClick={() => handleConfirm(true)} disabled={isProcessing || isGenericWalkIn} loading={isProcessing}>
                <Hand className="mr-2 h-4 w-4" />
                Update & Clear
              </Button>
            </div>
          ) : (
            <Button onClick={() => handleConfirm(true)} disabled={isProcessing || isGenericWalkIn} loading={isProcessing}>
              <Hand className="mr-2 h-4 w-4" />
              Add to Table
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
