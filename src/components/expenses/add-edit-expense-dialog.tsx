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
import { useFirestore, useCollection } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { collection, addDoc, serverTimestamp, doc, updateDoc, query, where, Timestamp } from 'firebase/firestore';
import type { Expense, PaymentMethod } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, DollarSign, AlertTriangle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/contexts/settings-context';


const expenseDialogSchema = z.object({
  date: z.date({ required_error: 'Please select a date.' }),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero.'),
  category: z.string().min(1, 'Category is required.'),
  description: z.string().min(1, 'Description is required.'),
  paymentMethod: z.string().min(1, 'Payment method is required.'),
});

type ExpenseDialogFormValues = z.infer<typeof expenseDialogSchema>;


interface AddEditExpenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
  onSuccess: () => void;
  accountBalances: Map<string, number>;
}

export function AddEditExpenseDialog({
  isOpen,
  onClose,
  expense,
  onSuccess,
  accountBalances,
}: AddEditExpenseDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { toast } = useToast();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const isEditMode = !!expense;

  const form = useForm<ExpenseDialogFormValues>({
    resolver: zodResolver(expenseDialogSchema),
  });

  const expenseCategoriesQuery = React.useMemo(() => firestore ? collection(firestore, 'expenseCategories') : null, [firestore]);
  const { data: categories } = useCollection(expenseCategoriesQuery);

  const paymentMethodsQuery = React.useMemo(() => firestore ? collection(firestore, 'paymentMethods') : null, [firestore]);
  const { data: paymentMethods } = useCollection(paymentMethodsQuery);

  React.useEffect(() => {
    if (expense) {
      form.reset({
        date: expense.date instanceof Timestamp ? expense.date.toDate() : new Date(expense.date),
        amount: expense.amount,
        category: expense.category,
        description: expense.description,
        paymentMethod: expense.paymentMethod,
      });
    } else {
      form.reset({
        date: new Date(),
        amount: 0,
        category: '',
        description: '',
        paymentMethod: '',
      });
    }
  }, [expense, form]);

  const selectedPaymentMethod = form.watch('paymentMethod');
  const expenseAmount = form.watch('amount');
  const balance = selectedPaymentMethod ? accountBalances.get(selectedPaymentMethod) : undefined;
  const hasInsufficientFunds = balance !== undefined && expenseAmount > balance;

  const formatCurrency = (value: number) => {
    if (isNaN(value) || value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  }

  const handleConfirm = async (data: ExpenseDialogFormValues) => {
    if (!firestore || !userProfile) {
      toast({ variant: 'destructive', title: 'Error', description: 'User or Firestore not available.' });
      return;
    }

    if (hasInsufficientFunds) {
      toast({ variant: 'destructive', title: 'Insufficient Funds', description: `The amount exceeds the balance in the ${selectedPaymentMethod} account.` });
      return;
    }

    setIsSaving(true);
    try {
        const expenseData = {
            ...data,
            date: Timestamp.fromDate(data.date),
            recordedBy: userProfile.name,
            recordedByUid: userProfile.uid,
            status: 'Recorded', // Default status
        };

      if (isEditMode) {
        const expenseRef = doc(firestore, 'expenses', expense!.id);
        await updateDoc(expenseRef, expenseData);
        toast({ variant: 'success', title: 'Expense Updated' });
      } else {
        await addDoc(collection(firestore, 'expenses'), { ...expenseData, createdAt: serverTimestamp() });
        toast({ variant: 'success', title: 'Expense Added' });
      }
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
          <DialogTitle>{isEditMode ? 'Edit' : 'Add'} Expense</DialogTitle>
          <DialogDescription>
            {isEditMode ? `Update the details for the expense: "${expense?.description}"` : 'Record a new business expense.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleConfirm)} id="expense-dialog-form" className="space-y-4 py-4">
                 <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Date of Expense</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant={'outline'}
                                    className={cn(
                                        'pl-3 text-left font-normal',
                                        !field.value && 'text-muted-foreground'
                                    )}
                                    >
                                    {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                 />
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl><Textarea placeholder="e.g., Office supplies" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {(categories as any[])?.map((cat: any) => (
                                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Amount</FormLabel>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <FormControl><Input type="number" placeholder="0.00" className="pl-8" {...field} /></FormControl>
                                </div>
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
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {(paymentMethods as any[])?.map((method) => (
                                            <SelectItem key={method.id} value={method.name}>{method.name} ({formatCurrency(accountBalances.get(method.name) || 0)})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                 {hasInsufficientFunds && (
                    <p className="text-sm font-medium text-destructive flex items-center gap-2 mt-2">
                        <AlertTriangle className="h-4 w-4"/>
                        Amount exceeds selected account balance.
                    </p>
                )}
            </form>
        </Form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" form="expense-dialog-form" loading={isSaving}>
            {isEditMode ? 'Save Changes' : 'Add Expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}