
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

interface HoldSaleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, clearCartOnSuccess: boolean) => Promise<void>;
  isProcessing: boolean;
  customerName?: string;
  isUpdate?: boolean;
}

export function HoldSaleDialog({ isOpen, onClose, onConfirm, isProcessing, customerName, isUpdate }: HoldSaleDialogProps) {
  const [name, setName] = React.useState('');
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      if (!isUpdate && (customerName === 'Walk-in Customer' || !customerName)) {
        setName('');
      } else {
        setName(customerName || '');
      }
    }
  }, [isOpen, customerName, isUpdate]);

  const handleConfirm = (clearCart: boolean) => {
    if (!name.trim()) {
        toast({
            variant: 'destructive',
            title: 'Table Name Required',
            description: 'Please enter a table name to add this to running tables.',
        });
        return;
    }
    onConfirm(name, clearCart);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isUpdate ? 'Update Running Table' : 'Add to Running Table'}</DialogTitle>
          <DialogDescription>
            {isUpdate
              ? `This will update the running table for "${name}".`
              : 'This will save the current cart as a running table. The cart will be cleared.'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="hold-name">Table Name</Label>
          <Input
            id="hold-name"
            value={name}
            disabled={isUpdate}
            onChange={(e) => setName(e.target.value)}
            className="font-semibold"
            placeholder="e.g., Table 5 or Bar Counter"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          {isUpdate ? (
            <>
              <Button onClick={() => handleConfirm(false)} disabled={isProcessing || !name.trim()} loading={isProcessing}>
                <Save className="mr-2 h-4 w-4" />
                Update Only
              </Button>
              <Button onClick={() => handleConfirm(true)} disabled={isProcessing || !name.trim()} loading={isProcessing}>
                <Hand className="mr-2 h-4 w-4" />
                Update & Clear
              </Button>
            </>
          ) : (
            <Button onClick={() => handleConfirm(true)} disabled={isProcessing || !name.trim()} loading={isProcessing}>
              <Hand className="mr-2 h-4 w-4" />
              Add to Table
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
