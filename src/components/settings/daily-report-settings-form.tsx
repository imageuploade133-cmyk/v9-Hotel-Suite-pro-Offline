
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
import { Loader2, Bell, Phone, Send } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { doc, setDoc } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { useSettings } from '@/contexts/settings-context';
import { Switch } from '../ui/switch';
import { AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';
import { Textarea } from '../ui/textarea';

const dailyReportSchema = z.object({
  enableDailyReport: z.boolean().default(false),
  dailyReportTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time in HH:mm format.').optional(),
  dailyReportPhoneNumber: z.string().optional(),
});

type DailyReportFormValues = z.infer<typeof dailyReportSchema>;

export function DailyReportSettingsForm() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const { settings, isLoading: isSettingsLoading, refreshSettings } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);
    const [isSendingTest, setIsSendingTest] = React.useState(false);

    const form = useForm<DailyReportFormValues>({
        resolver: zodResolver(dailyReportSchema),
        defaultValues: {
            enableDailyReport: false,
            dailyReportTime: '21:00',
            dailyReportPhoneNumber: '',
        },
    });

    React.useEffect(() => {
        if (settings) {
            form.reset({
                enableDailyReport: settings.enableDailyReport ?? false,
                dailyReportTime: settings.dailyReportTime || '21:00',
                dailyReportPhoneNumber: settings.dailyReportPhoneNumber || '',
            });
        }
    }, [settings, form]);

    const watchEnableReport = form.watch('enableDailyReport');
    const watchDailyReportPhoneNumber = form.watch('dailyReportPhoneNumber');
    const phoneNumbersCount = watchDailyReportPhoneNumber?.split(',').map(n => n.trim()).filter(Boolean).length || 0;


    async function onSubmit(data: DailyReportFormValues) {
        if (!user || !firestore) {
            toast({
                title: 'Error',
                description: 'User must be logged in to update settings.',
                variant: 'destructive',
            });
            return;
        }

        if (data.enableDailyReport && !data.dailyReportPhoneNumber) {
            form.setError('dailyReportPhoneNumber', { message: 'Phone number is required to enable daily reports.' });
            return;
        }

        setIsSaving(true);
        try {
            const settingsDocRef = doc(firestore, 'settings', 'global');
            await setDoc(settingsDocRef, data, { merge: true });

            toast({
                title: 'Daily Report Settings Updated',
                variant: 'success',
            });
            refreshSettings();
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

    const handleSendTest = async () => {
        if (!watchEnableReport || !form.getValues('dailyReportPhoneNumber')) {
            toast({
                variant: 'destructive',
                title: 'Cannot Send Test',
                description: 'Please enable daily reports and provide a recipient phone number first.',
            });
            return;
        }

        setIsSendingTest(true);
        toast({ title: 'Sending Test Report...', description: 'Please wait.' });
        try {
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/api/send-daily-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dates: [new Date().toISOString().split('T')[0]] })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to send test report.');
            }

            toast({
                variant: 'success',
                title: 'Test Report Sent',
                description: 'The daily income report was sent successfully.',
            });
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Error Sending Test',
                description: error.message,
            });
        } finally {
            setIsSendingTest(false);
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
                            <Bell className="h-5 w-5" />
                            Daily Income Report
                        </CardTitle>
                        <CardDescription>
                            Automatically send a summary of today's total income to WhatsApp numbers at a specified time.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField
                            control={form.control}
                            name="enableDailyReport"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Enable Daily Reports</FormLabel>
                                        <FormDescription>
                                            If enabled, an admin will be prompted to send reports for any missed days upon login.
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
                        {watchEnableReport && (
                            <div className="space-y-4 pl-4 border-l-2 ml-4">
                                <FormField
                                    control={form.control}
                                    name="dailyReportTime"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Report Time</FormLabel>
                                            <FormControl><Input type="time" {...field} value={field.value || '21:00'} /></FormControl>
                                            <FormDescription>The report will be sent on the first admin visit after this time each day.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="dailyReportPhoneNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Recipient WhatsApp Numbers <span className="text-muted-foreground font-normal">({phoneNumbersCount} total)</span></FormLabel>
                                             <FormControl>
                                                <Textarea
                                                    placeholder="Enter one or more numbers, separated by commas..."
                                                    {...field}
                                                    value={field.value || ''}
                                                    rows={3}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                You can send reports to multiple numbers by separating them with a comma.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4 flex justify-between">
                        <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Settings
                        </Button>
                        <Button type="button" variant="secondary" onClick={handleSendTest} disabled={isSaving || isSendingTest || !watchEnableReport || !form.getValues('dailyReportPhoneNumber')}>
                            {isSendingTest && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Send className="mr-2 h-4 w-4" />
                            Send Test Report
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
