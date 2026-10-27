
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DollarSign, Percent, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/settings-context';
import { cn } from '@/lib/utils';

interface DiscountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyDiscount: (type: 'percentage' | 'amount', value: number) => void;
  subtotal: number;
}

export function DiscountDialog({ isOpen, onClose, onApplyDiscount, subtotal }: DiscountDialogProps) {
  const [discountType, setDiscountType] = React.useState<'percentage' | 'amount'>('percentage');
  const [discountValue, setDiscountValue] = React.useState('');
  const { toast } = useToast();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';

  const handleApply = () => {
    const value = parseFloat(discountValue);
    if (isNaN(value) || value <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Value',
        description: 'Please enter a positive number for the discount.',
      });
      return;
    }
    if (discountType === 'amount' && value > subtotal) {
        toast({
            variant: 'destructive',
            title: 'Invalid Amount',
            description: 'Discount amount cannot be greater than the subtotal.',
        });
        return;
    }
    onApplyDiscount(discountType, value);
    onClose();
  };

  React.useEffect(() => {
    if (!isOpen) {
        setDiscountValue('');
        setDiscountType('percentage');
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Discount</DialogTitle>
          <DialogDescription>
            Select a discount type and enter the value.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <RadioGroup value={discountType} onValueChange={(value) => setDiscountType(value as any)} className="grid grid-cols-2 gap-4">
            <div>
              <RadioGroupItem value="percentage" id="percentage" className="sr-only peer" />
              <Label htmlFor="percentage" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                <Percent className="mb-3 h-6 w-6" />
                Percentage
              </Label>
            </div>
            <div>
              <RadioGroupItem value="amount" id="amount" className="sr-only peer" />
              <Label htmlFor="amount" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                <DollarSign className="mb-3 h-6 w-6" />
                Fixed Amount
              </Label>
            </div>
          </RadioGroup>
          <div>
            <Label htmlFor="discount-value">Discount Value</Label>
            <div className="relative mt-2">
              <Input
                id="discount-value"
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percentage' ? 'e.g., 10' : 'e.g., 50.00'}
                className={cn(discountType === 'amount' && 'pl-8')}
              />
              {discountType === 'amount' && <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
              {discountType === 'percentage' && <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={!discountValue}>
            <Tag className="mr-2 h-4 w-4" />
            Apply Discount
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
