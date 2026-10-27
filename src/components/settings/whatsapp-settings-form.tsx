
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '../ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquareText, Phone, Merge, Save } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { doc, setDoc } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { useSettings } from '@/contexts/settings-context';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';

const whatsAppSchema = z.object({
  whatsAppHeader: z.string().optional(),
  whatsAppFooter: z.string().optional(),
  enableTransferReceipts: z.boolean().default(false),
  transferReceiptPhoneNumber: z.string().optional(),
  enableReservationAlerts: z.boolean().default(false),
  reservationAlertPhoneNumber: z.string().optional(),
});

type WhatsAppFormValues = z.infer<typeof whatsAppSchema>;

export function WhatsAppSettingsForm() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const { settings, isLoading: isSettingsLoading, refreshSettings } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<WhatsAppFormValues>({
        resolver: zodResolver(whatsAppSchema),
        defaultValues: {
            whatsAppHeader: '',
            whatsAppFooter: '',
            enableTransferReceipts: false,
            transferReceiptPhoneNumber: '',
            enableReservationAlerts: false,
            reservationAlertPhoneNumber: '',
        },
    });

    React.useEffect(() => {
        if (settings) {
            form.reset({
                whatsAppHeader: settings.whatsAppHeader || `Message from ${settings.businessName || 'Us'}`,
                whatsAppFooter: settings.whatsAppFooter || 'Thank you.',
                enableTransferReceipts: settings.enableTransferReceipts || false,
                transferReceiptPhoneNumber: settings.transferReceiptPhoneNumber || '',
                enableReservationAlerts: settings.enableReservationAlerts || false,
                reservationAlertPhoneNumber: settings.reservationAlertPhoneNumber || '',
            });
        }
    }, [settings, form]);

    const watchEnableTransferReceipts = form.watch('enableTransferReceipts');
    const watchEnableReservationAlerts = form.watch('enableReservationAlerts');

    async function onSubmit(data: WhatsAppFormValues) {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'User must be logged in to update settings.' });
            return;
        }

        if (data.enableTransferReceipts && !data.transferReceiptPhoneNumber) {
            form.setError('transferReceiptPhoneNumber', { message: 'Phone number is required to enable transfer receipts.' });
            return;
        }

        if (data.enableReservationAlerts && !data.reservationAlertPhoneNumber) {
            form.setError('reservationAlertPhoneNumber', { message: 'Phone number is required to enable reservation alerts.' });
            return;
        }

        setIsSaving(true);
        try {
            const settingsDocRef = doc(firestore, 'settings', 'global');
            await setDoc(settingsDocRef, data, { merge: true });

            toast({
                title: 'WhatsApp Settings Updated',
                description: 'Your message templates and recipient lists have been saved.',
                variant: 'success',
            });
            refreshSettings();
            form.reset(data, { keepDirty: false });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to update settings.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }

    if (isSettingsLoading) {
        return <Skeleton className="h-48 w-full" />;
    }

    return (
        <Card>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquareText className="h-5 w-5" />
                            WhatsApp Messaging
                        </CardTitle>
                        <CardDescription>
                            Customize automated messages sent via WhatsApp.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4 rounded-md border p-4">
                            <FormField
                                control={form.control}
                                name="enableReservationAlerts"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">New Reservation Alerts</FormLabel>
                                            <FormDescription>
                                                Send an alert when a new reservation is made from the website.
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            {watchEnableReservationAlerts && (
                                 <div className="space-y-4 pl-4 border-l-2 ml-4">
                                    <FormField
                                        control={form.control}
                                        name="reservationAlertPhoneNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Recipient Numbers</FormLabel>
                                                <FormControl><Textarea placeholder="Enter one or more numbers, separated by commas..." {...field} value={field.value || ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="space-y-4 rounded-md border p-4">
                            <FormField
                                control={form.control}
                                name="enableTransferReceipts"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">Stock Transfer Receipts</FormLabel>
                                            <FormDescription>
                                                Automatically send a receipt when stock is transferred from staging.
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            {watchEnableTransferReceipts && (
                                 <FormField
                                    control={form.control}
                                    name="transferReceiptPhoneNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Recipient WhatsApp Number</FormLabel>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <FormControl><Input placeholder="e.g., +1234567890" className="pl-10" {...field} value={field.value || ''} /></FormControl>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                        <Separator />
                        <FormField
                            control={form.control}
                            name="whatsAppHeader"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Global Message Header</FormLabel>
                                    <FormControl><Input placeholder="e.g., A New Message From Our Hotel" {...field} value={field.value || ''} /></FormControl>
                                    <FormDescription>This text will appear at the top of every message.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="whatsAppFooter"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Global Message Footer</FormLabel>
                                    <FormControl><Textarea placeholder="e.g., Thank you for your patronage." {...field} value={field.value || ''} /></FormControl>
                                     <FormDescription>This text will appear at the bottom of every message.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save WhatsApp Settings
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
