'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Loader2, RefreshCw, DollarSign, CreditCard } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, addMonths, addYears, addDays } from 'date-fns';
import { useFirestore, useCollection } from '@/firebase';
import { doc, updateDoc, writeBatch, collection, serverTimestamp, doc as firestoreDoc } from 'firebase/firestore';
import type { GymMember, Payment, GymMembershipPlan } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { useUser } from '@/contexts/user-context';

const renewSchema = z.object({
  expiresAt: z.date({ required_error: 'An expiry date is required.' }),
  membershipFee: z.coerce.number().min(0, 'Fee must be a positive number.').optional(),
  paymentMethod: z.string().min(1, 'Payment method is required.'),
  planId: z.string().optional(),
});

type RenewFormValues = z.infer<typeof renewSchema>;

export function RenewMemberDialog({ open, onOpenChange, onSuccess, member }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (payment: Payment) => void;
  member: GymMember;
}) {
  const [isSaving, setIsSaving] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user, userProfile } = useUser();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';

  const paymentMethodsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'paymentMethods');
  }, [firestore]);
  const { data: paymentMethods } = useCollection(paymentMethodsQuery);

  const membershipPlansQuery = React.useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'gymMembershipPlans');
  }, [firestore]);
  const { data: membershipPlans } = useCollection<GymMembershipPlan>(membershipPlansQuery);

  const form = useForm<RenewFormValues>({
    resolver: zodResolver(renewSchema),
    defaultValues: {
      expiresAt: addDays(new Date(), 30),
      membershipFee: 0,
    },
  });

  const selectedPlanId = form.watch('planId');

  React.useEffect(() => {
    if (selectedPlanId && membershipPlans) {
        const plan = membershipPlans.find(p => p.id === selectedPlanId);
        if (plan) {
            form.setValue('membershipFee', plan.price);
            form.setValue('expiresAt', addDays(new Date(), plan.duration));
        }
    }
  }, [selectedPlanId, membershipPlans, form]);

  React.useEffect(() => {
    if (open) {
      form.reset({
        expiresAt: addDays(new Date(), 30),
        membershipFee: 0,
        paymentMethod: undefined,
        planId: undefined,
      });
    }
  }, [open, form]);

  const onSubmit = async (data: RenewFormValues) => {
    if (!firestore || !user || !userProfile || !selectedPlanId) return;

    const selectedPlan = membershipPlans?.find(p => p.id === selectedPlanId);
    if (!selectedPlan) return;

    setIsSaving(true);
    try {
        const batch = writeBatch(firestore);
        const memberRef = doc(firestore, 'gym-members', member.id);

        batch.update(memberRef, {
            expiresAt: data.expiresAt,
            membershipFee: data.membershipFee,
            planId: data.planId,
            paymentMethod: data.paymentMethod,
        });

        let paymentRecord: Payment | null = null;
        if (data.paymentMethod && data.membershipFee && data.membershipFee > 0) {
            const paymentRef = firestoreDoc(collection(firestore, 'payments'));
            const paymentData: Payment = {
                id: paymentRef.id,
                guestName: member.name,
                guestEmail: member.email,
                amount: data.membershipFee,
                paymentMethod: data.paymentMethod,
                status: 'Paid',
                transactionDate: new Date(),
                type: 'Gym Membership',
                createdByUid: user.uid,
                createdByName: userProfile.name,
            };
            batch.set(paymentRef, paymentData);
            paymentRecord = paymentData;
        }

      await batch.commit();
      toast({ variant: 'success', title: 'Membership Renewed' });
      if (paymentRecord) {
        onSuccess(paymentRecord);
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renew Membership for {member.name}</DialogTitle>
          <DialogDescription>Set a new expiry date for the member's gym access.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="renew-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             <FormField
                control={form.control}
                name="planId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Membership Plan</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a membership plan" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {(membershipPlans as any[])?.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                                {plan.name} - ${plan.price} ({plan.duration} days)
                            </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
              control={form.control}
              name="expiresAt"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>New Expiry Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus fromDate={new Date()}/>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="membershipFee"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Renewal Fee</FormLabel>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currency}</span>
                        <FormControl><Input type="number" {...field} readOnly className="pl-10" /></FormControl>
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
                     <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger className="pl-10"><SelectValue placeholder="Select a payment method" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {(paymentMethods as any[])?.map((method: any) => (
                                <SelectItem key={method.id} value={method.name}>
                                    {method.name}
                                </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <FormMessage />
                    </FormItem>
                )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button type="submit" form="renew-form" loading={isSaving}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Renew Membership
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
