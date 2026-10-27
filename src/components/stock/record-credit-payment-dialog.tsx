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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/settings-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { CreditSale } from '@/app/(protected)/credit-sales/columns';
import { Separator } from '../ui/separator';

const paymentSchema = z.object({
  paymentAmount: z.coerce.number().positive('Amount must be positive.'),
  paymentMethod: z.string().min(1, 'Payment method is required.'),
  paymentRef: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface RecordCreditPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sale: CreditSale | null;
  onConfirm: (sale: CreditSale, paymentAmount: number, paymentMethod: string, paymentRef: string) => Promise<void>;
}

export function RecordCreditPaymentDialog({ isOpen, onClose, sale, onConfirm }: RecordCreditPaymentDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const { settings } = useSettings();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
  });

  const paymentMethodsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paymentMethods'));
  }, [firestore]);
  const { data: paymentMethods } = useCollection(paymentMethodsQuery);

  React.useEffect(() => {
    if (sale) {
      form.reset({
        paymentAmount: sale.outstandingBalance,
        paymentMethod: undefined,
        paymentRef: '',
      });
    }
  }, [sale, form]);

  const onSubmit = async (data: PaymentFormValues) => {
    if (!sale) return;

    if (data.paymentAmount > sale.outstandingBalance) {
      form.setError('paymentAmount', {
        type: 'manual',
        message: 'Payment cannot exceed the outstanding balance.',
      });
      return;
    }

    setIsSaving(true);
    try {
      await onConfirm(sale, data.paymentAmount, data.paymentMethod, data.paymentRef || '');
      toast({ variant: 'success', title: 'Payment Recorded' });
      onClose();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const currency = settings?.currency || 'USD';
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  if (!sale) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment for Sale #{sale.saleId}</DialogTitle>
          <DialogDescription>
            Record a partial or full payment for the credit sale to {sale.customerName}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="p-3 rounded-md border bg-muted">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">Total Sale Amount:</span>
              <span className="font-semibold">{formatCurrency(sale.totalAmount)}</span>
            </div>
             <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">Total Paid:</span>
              <span className="font-semibold text-green-600">{formatCurrency(sale.totalPaid)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-baseline font-bold text-lg">
              <span>Outstanding Balance:</span>
              <span className="text-destructive">{formatCurrency(sale.outstandingBalance)}</span>
            </div>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} id="record-payment-form" className="space-y-4">
              <FormField
                control={form.control}
                name="paymentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount to Pay</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select payment method" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(paymentMethods as any[])?.map((method) => (
                          <SelectItem key={method.id} value={method.name}>{method.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentRef"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., Transaction ID, Cheque No." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" form="record-payment-form" loading={isSaving}>
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
