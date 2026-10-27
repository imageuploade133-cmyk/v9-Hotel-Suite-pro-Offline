
'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { collection, doc, serverTimestamp, updateDoc, Timestamp, writeBatch, query } from 'firebase/firestore';
import type { Expense, Payment, Booking, StockSale, SalonService, StockReturn, Transfer } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, DollarSign, AlertTriangle, Trash2, PlusCircle, ArrowLeft } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/contexts/settings-context';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent, CardFooter } from '../ui/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ExpensesLoading from '@/app/(protected)/expenses/loading';
import { useAccountBalances } from '@/hooks/use-account-balances';

const paymentSchema = z.object({
  paymentMethod: z.string().min(1, "Method is required."),
  amount: z.coerce.number().min(0.01, "Amount must be positive."),
});

const expenseSchema = z.object({
  date: z.date({ required_error: 'Please select a date.' }),
  totalAmount: z.coerce.number().min(0.01, 'Amount must be greater than zero.'),
  category: z.string().min(1, 'Category is required.'),
  description: z.string().min(1, 'Description is required.'),
  payments: z.array(paymentSchema).min(1, "At least one payment method is required."),
}).superRefine((data, ctx) => {
    const totalPayment = data.payments.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(totalPayment - data.totalAmount) > 0.001) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["payments"],
            message: `The sum of payments (${totalPayment.toFixed(2)}) must equal the total expense amount (${data.totalAmount.toFixed(2)}).`,
        });
    }
});


type ExpenseFormValues = z.infer<typeof expenseSchema>;

export function ExpenseForm({ expenseId }: { expenseId?: string }) {
    const [isSaving, setIsSaving] = React.useState(false);
    const firestore = useFirestore();
    const { userProfile } = useUser();
    const { toast } = useToast();
    const { settings } = useSettings();
    const router = useRouter();

    const isEditMode = !!expenseId;

    const {data: expenseToEdit, isLoading: isExpenseLoading} = useDoc<Expense>(
        React.useMemo(() => (firestore && expenseId) ? doc(firestore, 'expenses', expenseId) : null, [firestore, expenseId])
    );

    const form = useForm<ExpenseFormValues>({
        resolver: zodResolver(expenseSchema),
        defaultValues: { date: new Date(), payments: [{ paymentMethod: '', amount: 0 }], },
    });

    const { fields, append, remove, update } = useFieldArray({
        control: form.control,
        name: "payments",
    });

    const watchedPayments = form.watch('payments');
    const watchedTotalAmount = form.watch('totalAmount');
    const totalPaid = watchedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const remainingToPay = (watchedTotalAmount || 0) - totalPaid;

    const expenseCategoriesQuery = React.useMemo(() => firestore ? collection(firestore, 'expenseCategories') : null, [firestore]);
    const { data: categories } = useCollection(expenseCategoriesQuery);

    const paymentMethodsQuery = React.useMemo(() => firestore ? collection(firestore, 'paymentMethods') : null, [firestore]);
    const { data: paymentMethods } = useCollection(paymentMethodsQuery);

    const { accountBalances, isLoading: areBalancesLoading } = useAccountBalances();

    React.useEffect(() => {
        if (isEditMode && expenseToEdit) {
            form.reset({
                date: expenseToEdit.date instanceof Timestamp ? expenseToEdit.date.toDate() : new Date(expenseToEdit.date),
                totalAmount: expenseToEdit.amount,
                category: expenseToEdit.category,
                description: expenseToEdit.description,
                payments: [{ paymentMethod: expenseToEdit.paymentMethod, amount: expenseToEdit.amount }],
            });
        }
    }, [expenseToEdit, isEditMode, form]);

    React.useEffect(() => {
        if (fields.length === 1) {
            const currentAmount = form.getValues('payments.0.amount');
            const totalAmount = form.getValues('totalAmount');
            if (currentAmount !== totalAmount) {
                form.setValue('payments.0.amount', totalAmount || 0, { shouldValidate: true });
            }
        }
    }, [watchedTotalAmount, fields.length, form]);

    const handleFormSubmit = async (data: ExpenseFormValues) => {
        if (!firestore || !userProfile) return;
        setIsSaving(true);

        try {
            const batch = writeBatch(firestore);

            if (isEditMode && expenseId) {
                // Delete the old expense first
                const oldExpenseRef = doc(firestore, 'expenses', expenseId);
                batch.delete(oldExpenseRef);
            }

            data.payments.forEach(payment => {
                const expenseRef = doc(collection(firestore, 'expenses'));
                batch.set(expenseRef, {
                    description: data.description,
                    amount: payment.amount,
                    category: data.category,
                    date: Timestamp.fromDate(data.date),
                    paymentMethod: payment.paymentMethod,
                    staffId: userProfile.uid,
                    staffName: userProfile.name,
                    status: 'Recorded',
                    createdAt: serverTimestamp(),
                });
            });

            await batch.commit();

            toast({ variant: 'success', title: `Expense ${isEditMode ? 'Updated' : 'Recorded'}` });
            router.push('/expenses');

        } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
        setIsSaving(false);
        }
    };

    const isLoading = isSaving || isExpenseLoading || areBalancesLoading;
    const currency = settings?.currency || 'USD';
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);


    if (isLoading) {
        return <ExpensesLoading />;
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 max-w-4xl mx-auto">
                 <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/expenses">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{isEditMode ? 'Edit Expense' : 'Create New Expense'}</h1>
                        <p className="text-muted-foreground">Fill in the details below to record an expense.</p>
                    </div>
                </div>

                <Card>
                    <CardContent className="pt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="date" render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>Date</FormLabel>
                                    <Popover><PopoverTrigger asChild><FormControl><Button variant={'outline'} className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                                        {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="category" render={({ field }) => (
                                <FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
                                    <SelectContent>{(categories as any[])?.map((cat: any) => (<SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>))}</SelectContent></Select>
                                <FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="e.g., Office supplies from Stationery Stop" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="totalAmount" render={({ field }) => (
                            <FormItem><FormLabel>Total Expense Amount ({currency})</FormLabel><div className="relative"><DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" placeholder="0.00" className="pl-8" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl></div><FormMessage /></FormItem>
                        )} />
                        <Separator />
                        <div className="space-y-4">
                            <h4 className="font-medium">Payment Breakdown</h4>
                            {fields.map((field, index) => {
                                const selectedMethod = watchedPayments[index]?.paymentMethod;
                                const balance = selectedMethod ? accountBalances.get(selectedMethod) : undefined;
                                const hasInsufficientFunds = balance !== undefined && watchedPayments[index]?.amount > balance;

                                return (
                                    <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end p-3 border rounded-lg">
                                        <FormField control={form.control} name={`payments.${index}.paymentMethod`} render={({ field }) => (
                                            <FormItem><FormLabel>Payment Method</FormLabel><Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger></FormControl>
                                                <SelectContent>{(paymentMethods as any[])?.map((method: any) => (
                                                    <SelectItem key={method.id} value={method.name}>{method.name} ({formatCurrency(accountBalances.get(method.name) || 0)})</SelectItem>
                                                ))}</SelectContent></Select><FormMessage /></FormItem>
                                        )}/>
                                        <FormField control={form.control} name={`payments.${index}.amount`} render={({ field }) => (
                                            <FormItem><FormLabel>Amount</FormLabel><div className="relative"><DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" step="0.01" className="pl-8" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl></div><FormMessage /></FormItem>
                                        )}/>
                                        <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                        {hasInsufficientFunds && <p className="text-xs font-medium text-destructive col-span-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4"/>Insufficient funds in this account.</p>}
                                    </div>
                                )
                            })}
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ paymentMethod: '', amount: Math.max(0, remainingToPay) })}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Payment Method
                            </Button>
                        </div>
                        {form.formState.errors.payments && (
                            <p className="text-sm font-medium text-destructive">{form.formState.errors.payments.root?.message}</p>
                        )}
                    </CardContent>
                    <CardFooter className="justify-end gap-2">
                        <Button type="button" variant="ghost" asChild>
                            <Link href="/expenses">Cancel</Link>
                        </Button>
                        <Button type="submit" loading={isSaving}>
                            {isEditMode ? 'Save Changes' : 'Record Expense'}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}
