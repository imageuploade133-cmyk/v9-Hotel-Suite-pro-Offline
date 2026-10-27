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
import { Loader2, Clock } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { doc, setDoc, writeBatch, collection, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { useSettings } from '@/contexts/settings-context';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';

const hotelPolicySchema = z.object({
  checkoutTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time in HH:mm format.'),
  checkInTimeOption: z.enum(['exact', 'default']).default('exact'),
  defaultCheckInTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time in HH:mm format.').optional(),
  allowSameDayBooking: z.boolean().default(false),
}).refine(data => {
    if (data.checkInTimeOption === 'default' && !data.defaultCheckInTime) {
        return false;
    }
    return true;
}, {
    message: "Default check-in time is required when the 'default time' option is selected.",
    path: ['defaultCheckInTime'],
});

type HotelPolicyFormValues = z.infer<typeof hotelPolicySchema>;

export function HotelPolicyForm() {
    const { toast } = useToast();
    const { user, userProfile } = useUser();
    const firestore = useFirestore();
    const { settings, isLoading: isSettingsLoading } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<HotelPolicyFormValues>({
        resolver: zodResolver(hotelPolicySchema),
        defaultValues: {
            checkoutTime: '11:00',
            checkInTimeOption: 'exact',
            defaultCheckInTime: '14:00',
            allowSameDayBooking: false,
        },
    });

    const checkInTimeOption = form.watch('checkInTimeOption');

    React.useEffect(() => {
        if (settings) {
            form.reset({
                checkoutTime: settings.checkoutTime || '11:00',
                checkInTimeOption: settings.checkInTimeOption || 'exact',
                defaultCheckInTime: settings.defaultCheckInTime || '14:00',
                allowSameDayBooking: settings.allowSameDayBooking || false,
            });
        }
    }, [settings, form]);

    async function onSubmit(data: HotelPolicyFormValues) {
        if (!user || !firestore || !userProfile) {
            toast({
                title: 'Error',
                description: 'User must be logged in to update settings.',
                variant: 'destructive',
            });
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const settingsDocRef = doc(firestore, 'settings', 'global');

            const changes: {field: string, before: any, after: any}[] = [];
            for (const key in data) {
                const formKey = key as keyof HotelPolicyFormValues;
                const formValue = data[formKey];
                const settingsValue = settings ? settings[formKey] : undefined;

                if (JSON.stringify(formValue) !== JSON.stringify(settingsValue)) {
                    changes.push({
                        field: key.replace(/([A-Z])/g, ' $1').trim(),
                        before: settingsValue === undefined ? 'Not set' : settingsValue,
                        after: formValue,
                    });
                }
            }

            if (changes.length > 0) {
                batch.set(settingsDocRef, data, { merge: true });
                const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
                batch.set(auditLogRef, {
                    timestamp: serverTimestamp(),
                    userId: userProfile.uid,
                    userName: userProfile.name,
                    changeType: 'Update',
                    entityType: 'Settings',
                    entityId: 'Hotel Policy',
                    details: 'Updated hotel-wide policies.',
                    changes,
                });
                await batch.commit();
            }

            toast({
                title: 'Hotel Policy Updated',
                description: `Your hotel policies have been successfully updated.`,
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
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-72" />
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                   <Skeleton className="h-10 w-40" />
                </CardFooter>
            </Card>
        )
    }

    return (
        <AccordionItem value="hotel-policy">
            <Card>
                <AccordionTrigger className="p-6">
                    <div className="flex items-center gap-3">
                        <Clock className="h-6 w-6 text-muted-foreground" />
                        <div>
                            <CardTitle>Hotel Policy</CardTitle>
                            <CardDescription className="text-left mt-1">Set general policies for your hotel's operations.</CardDescription>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-6 pt-0">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <fieldset disabled={isLoading} className="group">
                                <CardContent className="space-y-6 group-disabled:opacity-50">
                                    <div>
                                        <h4 className="font-medium text-foreground mb-2">Check-in Time Policy</h4>
                                        <FormField
                                            control={form.control}
                                            name="checkInTimeOption"
                                            render={({ field }) => (
                                                <FormItem className="space-y-3">
                                                    <FormControl>
                                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="space-y-2">
                                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                                <FormControl><RadioGroupItem value="exact" /></FormControl>
                                                                <FormLabel className="font-normal">Use exact time of check-in</FormLabel>
                                                            </FormItem>
                                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                                <FormControl><RadioGroupItem value="default" /></FormControl>
                                                                <FormLabel className="font-normal">Use a default time for all check-ins</FormLabel>
                                                            </FormItem>
                                                        </RadioGroup>
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        {checkInTimeOption === 'default' && (
                                            <div className="pl-6 pt-4">
                                                <FormField
                                                    control={form.control}
                                                    name="defaultCheckInTime"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Default Check-in Time</FormLabel>
                                                            <FormControl><Input type="time" {...field} value={field.value || ''} className="w-48" /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <Separator />

                                    <div>
                                        <h4 className="font-medium text-foreground mb-2">Check-out Time Policy</h4>
                                        <FormField
                                            control={form.control}
                                            name="checkoutTime"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Default Check-out Time</FormLabel>
                                                    <FormControl><Input type="time" {...field} value={field.value || ''} className="w-48" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <Separator />

                                    <div>
                                        <h4 className="font-medium text-foreground mb-2">Booking Policy</h4>
                                        <FormField
                                            control={form.control}
                                            name="allowSameDayBooking"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base">Allow Same-Day Bookings</FormLabel>
                                                    <FormDescription>
                                                    If enabled, selecting one date will create a one-day booking (check-in and check-out on the same day). If disabled, it defaults to an overnight stay.
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
                                    </div>
                                </CardContent>
                                <CardFooter className="border-t px-6 py-4">
                                    <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Policy
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
