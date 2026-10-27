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
import type { SalonService } from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useToast } from '@/hooks/use-toast';

interface PaySalonOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: SalonService | null;
  onConfirmPayment: (order: SalonService, paymentMethod: string) => Promise<void>;
}

export function PaySalonOrderDialog({
  isOpen,
  onClose,
  order,
  onConfirmPayment,
}: PaySalonOrderDialogProps) {
  const { settings } = useSettings();
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<string | undefined>();
  const firestore = useFirestore();
  const { toast } = useToast();

  const paymentMethodsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paymentMethods'));
  }, [firestore]);
  const { data: paymentMethods } = useCollection(paymentMethodsQuery);

  const currency = settings?.currency || 'USD';

  React.useEffect(() => {
      if (isOpen) {
          setSelectedPaymentMethod(undefined);
          setIsSaving(false);
      }
  }, [isOpen]);

  if (!order) return null;

  const handleConfirm = async () => {
    if (!selectedPaymentMethod) {
        toast({
            variant: 'destructive',
            title: 'Payment Method Required',
            description: 'Please select a payment method to continue.',
        });
        return;
    }

    setIsSaving(true);
    try {
      await onConfirmPayment(order, selectedPaymentMethod);
    } catch (error) {
       // Parent component will show a toast on error
       console.error("Payment failed:", error);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collect Payment</DialogTitle>
          <DialogDescription>
            Confirm payment for order <span className="font-mono">#{order.orderNumber}</span> for <span className="font-bold">{order.customerName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <h3 className="mb-4 text-lg font-semibold text-center">
            Collect Payment: {new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(order.totalPrice)}
          </h3>
          <Select onValueChange={setSelectedPaymentMethod} value={selectedPaymentMethod} disabled={isSaving}>
              <SelectTrigger>
                  <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Select a payment method" />
                  </div>
              </SelectTrigger>
              <SelectContent>
                  {paymentMethods?.map((method: any) => (
                      <SelectItem key={method.id} value={method.name}>
                          {method.name}
                      </SelectItem>
                  ))}
              </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSaving || !selectedPaymentMethod} loading={isSaving}>
            <CircleDollarSign className="mr-2 h-4 w-4" />
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
