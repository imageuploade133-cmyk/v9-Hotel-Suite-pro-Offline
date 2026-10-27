'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '../ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileX } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { doc, setDoc } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { useSettings } from '@/contexts/settings-context';
import { Textarea } from '../ui/textarea';
import { AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';

const cancellationPolicySchema = z.object({
  cancellationMessagePrepaid: z.string().optional(),
  cancellationMessageUnpaid: z.string().optional(),
  cancellationMessageActive: z.string().optional(),
  cancellationFooterLine1: z.string().optional(),
  cancellationFooterLine2: z.string().optional(),
  unpaidInvoiceFooterLine1: z.string().optional(),
  unpaidInvoiceFooterLine2: z.string().optional(),
});

type CancellationPolicyFormValues = z.infer<typeof cancellationPolicySchema>;

const defaultMessages = {
  prepaid: 'A refund for the pre-paid amount has been issued. The funds should appear in the original account within 5-10 business days.',
  unpaid: 'This was an unpaid reservation; therefore, no refund is due.',
  active: "The guest's booking has been terminated, and a full refund has been processed.",
  cancellationFooter1: 'This is an official cancellation confirmation.',
  cancellationFooter2: 'Hotel Suite Pro | This is a computer-generated document.',
  unpaidFooter1: 'Thank you for choosing us!',
  unpaidFooter2: 'This is a computer-generated document.',
};


export function CancellationPolicyForm() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const { settings, isLoading: isSettingsLoading } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<CancellationPolicyFormValues>({
        resolver: zodResolver(cancellationPolicySchema),
        defaultValues: {
            cancellationMessagePrepaid: '',
            cancellationMessageUnpaid: '',
            cancellationMessageActive: '',
            cancellationFooterLine1: '',
            cancellationFooterLine2: '',
            unpaidInvoiceFooterLine1: '',
            unpaidInvoiceFooterLine2: '',
        },
    });
    const { reset } = form;

    React.useEffect(() => {
        if (settings) {
            reset({
                cancellationMessagePrepaid: settings.cancellationMessagePrepaid || defaultMessages.prepaid,
                cancellationMessageUnpaid: settings.cancellationMessageUnpaid || defaultMessages.unpaid,
                cancellationMessageActive: settings.cancellationMessageActive || defaultMessages.active,
                cancellationFooterLine1: settings.cancellationFooterLine1 || defaultMessages.cancellationFooter1,
                cancellationFooterLine2: settings.cancellationFooterLine2 || defaultMessages.cancellationFooter2,
                unpaidInvoiceFooterLine1: settings.unpaidInvoiceFooterLine1 || defaultMessages.unpaidFooter1,
                unpaidInvoiceFooterLine2: settings.unpaidInvoiceFooterLine2 || defaultMessages.unpaidFooter2,
            });
        }
    }, [settings, reset]);


    async function onSubmit(data: CancellationPolicyFormValues) {
        if (!user || !firestore) {
            toast({
                title: 'Error',
                description: 'User must be logged in to update settings.',
                variant: 'destructive',
            });
            return;
        }

        setIsSaving(true);
        try {
            const settingsDocRef = doc(firestore, 'settings', 'global');
            await setDoc(settingsDocRef, data, { merge: true });

            toast({
                title: 'Invoice Text Updated',
                description: 'Your custom invoice messages have been saved.',
                variant: 'success',
            });
             form.reset(data, { keepDirty: false });
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to update settings.',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    }

    const isLoading = isSaving || isSettingsLoading;

    if (isSettingsLoading) {
         return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-full max-w-lg" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                     <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                     <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                   <Skeleton className="h-10 w-40" />
                </CardFooter>
            </Card>
        )
    }

    return (
        <AccordionItem value="cancellation-policy">
            <Card>
                <AccordionTrigger className="p-6">
                     <div className="flex items-center gap-3">
                        <FileX className="h-6 w-6 text-muted-foreground" />
                        <div>
                            <CardTitle>Invoice &amp; Receipt Text</CardTitle>
                            <CardDescription className="text-left mt-1">Customize the text that appears on various invoices and receipts.</CardDescription>
                        </div>
                    </div>
                </AccordionTrigger>
                 <AccordionContent className="p-6 pt-0">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <fieldset disabled={isLoading} className="group">
                                <CardContent className="space-y-6 group-disabled:opacity-50">
                                    <div>
                                        <h4 className="font-medium mb-2">Cancellation Invoice: Details Messages</h4>
                                        <div className="space-y-4 rounded-md border p-4">
                                            <FormField
                                                control={form.control}
                                                name="cancellationMessageUnpaid"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>For Unpaid Reservations</FormLabel>
                                                        <FormControl>
                                                            <Textarea {...field} rows={3} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="cancellationMessagePrepaid"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>For Pre-Paid Reservations</FormLabel>
                                                        <FormControl>
                                                            <Textarea {...field} rows={3} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="cancellationMessageActive"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>For Cancellations of Active/Checked-in Bookings</FormLabel>
                                                        <FormControl>
                                                            <Textarea {...field} rows={3} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-medium mb-2">Cancellation Invoice: Footer Messages</h4>
                                        <div className="space-y-4 rounded-md border p-4">
                                            <FormField
                                                control={form.control}
                                                name="cancellationFooterLine1"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Footer Line 1</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="cancellationFooterLine2"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Footer Line 2</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-medium mb-2">Unpaid Invoice: Footer Messages</h4>
                                        <div className="space-y-4 rounded-md border p-4">
                                            <FormField
                                                control={form.control}
                                                name="unpaidInvoiceFooterLine1"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Footer Line 1</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="unpaidInvoiceFooterLine2"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Footer Line 2</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="border-t px-6 py-4">
                                    <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Messages
                                    </Button>
                                </CardFooter>
                            </fieldset>
                        </form>
                    </Form>
                 </AccordionContent>
            </Card>
        </AccordionItem>
    );
}
