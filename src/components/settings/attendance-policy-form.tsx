
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
import { Loader2, Clock, DollarSign } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { doc, setDoc, writeBatch, collection, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { useSettings } from '@/contexts/settings-context';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';


const attendanceSchema = z.object({
  shiftSettings: z.object({
    morning: z.object({
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time in HH:mm format.'),
      lateGracePeriod: z.coerce.number().min(0, 'Grace period must be non-negative.'),
    }),
    night: z.object({
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time in HH:mm format.'),
      lateGracePeriod: z.coerce.number().min(0, 'Grace period must be non-negative.'),
    }),
    twentyFourHours: z.object({
        trackLateness: z.boolean().default(false),
        lateAfterTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time in HH:mm format.').optional(),
    }).optional(),
    enableAutoDeduction: z.boolean().default(false),
    lateDeductionAmount: z.coerce.number().min(0, "Deduction must be a non-negative number.").optional(),
  }),
});

type AttendanceFormValues = z.infer<typeof attendanceSchema>;

export function AttendancePolicyForm() {
    const { toast } = useToast();
    const { user, userProfile } = useUser();
    const firestore = useFirestore();
    const { settings, isLoading: isSettingsLoading } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<AttendanceFormValues>({
        resolver: zodResolver(attendanceSchema),
        defaultValues: {
            shiftSettings: {
                morning: { startTime: '09:00', lateGracePeriod: 5 },
                night: { startTime: '21:00', lateGracePeriod: 5 },
                twentyFourHours: { trackLateness: false, lateAfterTime: '09:00' },
                enableAutoDeduction: false,
                lateDeductionAmount: 0,
            }
        },
    });

    React.useEffect(() => {
        if (settings?.shiftSettings) {
            form.reset({
                shiftSettings: {
                    morning: {
                        startTime: settings.shiftSettings.morning.startTime || '09:00',
                        lateGracePeriod: settings.shiftSettings.morning.lateGracePeriod ?? 5,
                    },
                    night: {
                        startTime: settings.shiftSettings.night.startTime || '21:00',
                        lateGracePeriod: settings.shiftSettings.night.lateGracePeriod ?? 5,
                    },
                    twentyFourHours: {
                        trackLateness: settings.shiftSettings.twentyFourHours?.trackLateness ?? false,
                        lateAfterTime: settings.shiftSettings.twentyFourHours?.lateAfterTime || '09:00',
                    },
                    enableAutoDeduction: settings.shiftSettings.enableAutoDeduction ?? false,
                    lateDeductionAmount: settings.shiftSettings.lateDeductionAmount ?? 0,
                }
            });
        }
    }, [settings, form]);

    const watchTrackLateness = form.watch('shiftSettings.twentyFourHours.trackLateness');
    const watchEnableAutoDeduction = form.watch('shiftSettings.enableAutoDeduction');


    async function onSubmit(data: AttendanceFormValues) {
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

            const oldSettings = settings?.shiftSettings || {};
            const newSettings = data.shiftSettings;

            if (JSON.stringify(oldSettings) !== JSON.stringify(newSettings)) {
                changes.push({ field: 'Shift Settings', before: oldSettings, after: newSettings });
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
                    entityId: 'Attendance Policy',
                    details: 'Updated staff attendance policy.',
                    changes,
                });

                await batch.commit();
            }

            toast({
                title: 'Attendance Policy Updated',
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
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-full max-w-lg" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                   <Skeleton className="h-10 w-40" />
                </CardFooter>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Clock className="h-6 w-6 text-muted-foreground" />
                    <div>
                        <CardTitle>Staff Attendance Policy</CardTitle>
                        <CardDescription>Set shift start times and grace periods for late arrivals.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <fieldset disabled={isLoading} className="group">
                        <CardContent className="space-y-6 group-disabled:opacity-50">
                            <div className="p-4 border rounded-lg">
                                <h4 className="font-medium text-foreground mb-4">Morning Shift</h4>
                                <div className="flex items-end gap-4">
                                    <FormField
                                        control={form.control}
                                        name="shiftSettings.morning.startTime"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Start Time</FormLabel>
                                                <FormControl><Input type="time" {...field} value={field.value} className="w-48" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="shiftSettings.morning.lateGracePeriod"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Late Grace Period</FormLabel>
                                                <div className="flex items-center gap-2">
                                                    <FormControl><Input type="number" {...field} value={field.value} className="w-24" /></FormControl>
                                                    <span className="text-sm text-muted-foreground">minutes</span>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="p-4 border rounded-lg">
                                <h4 className="font-medium text-foreground mb-4">Night Shift</h4>
                                <div className="flex items-end gap-4">
                                    <FormField
                                        control={form.control}
                                        name="shiftSettings.night.startTime"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Start Time</FormLabel>
                                                <FormControl><Input type="time" {...field} value={field.value} className="w-48" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="shiftSettings.night.lateGracePeriod"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Late Grace Period</FormLabel>
                                                <div className="flex items-center gap-2">
                                                    <FormControl><Input type="number" {...field} value={field.value} className="w-24" /></FormControl>
                                                    <span className="text-sm text-muted-foreground">minutes</span>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="p-4 border rounded-lg">
                                <h4 className="font-medium text-foreground mb-4">24hrs Shift</h4>
                                <FormField
                                    control={form.control}
                                    name="shiftSettings.twentyFourHours.trackLateness"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">Track Lateness</FormLabel>
                                            <FormDescription>If enabled, you can set a daily time after which a login is considered late.</FormDescription>
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
                                {watchTrackLateness && (
                                    <div className="pt-4 mt-4 border-t">
                                        <FormField
                                            control={form.control}
                                            name="shiftSettings.twentyFourHours.lateAfterTime"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Late After Time</FormLabel>
                                                    <FormControl><Input type="time" {...field} value={field.value || '09:00'} className="w-48" /></FormControl>
                                                    <FormDescription>Logins after this time will be marked as "Late".</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}
                            </div>

                            <Separator />

                            <div className="p-4 border rounded-lg space-y-4">
                                <h4 className="font-medium text-foreground">Automatic Deduction for Lateness</h4>
                                <FormField
                                    control={form.control}
                                    name="shiftSettings.enableAutoDeduction"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">Enable Automatic Deduction</FormLabel>
                                            <FormDescription>
                                            If enabled, a fixed amount will be deducted from a staff member's salary for each day they are late.
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
                                {watchEnableAutoDeduction && (
                                    <div className="pt-4 mt-4 border-t">
                                        <FormField
                                            control={form.control}
                                            name="shiftSettings.lateDeductionAmount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Late Deduction Amount</FormLabel>
                                                        <div className="relative">
                                                        <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                        <FormControl><Input type="number" placeholder="e.g. 10" className="pl-8" {...field} value={field.value || ''} /></FormControl>
                                                    </div>
                                                    <FormDescription>The amount to deduct for each late arrival per day.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}
                            </div>

                        </CardContent>
                        <CardFooter className="border-t px-6 py-4">
                            <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Attendance Policy
                            </Button>
                        </CardFooter>
                    </fieldset>
                </form>
            </Form>
        </Card>
    );
}
