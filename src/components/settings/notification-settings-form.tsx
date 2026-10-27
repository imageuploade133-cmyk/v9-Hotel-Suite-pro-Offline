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
import { Loader2, Bell, Volume2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { doc, setDoc } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { useSettings } from '@/contexts/settings-context';
import { Switch } from '../ui/switch';
import { AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';

const notificationSettingsSchema = z.object({
  enableNotificationSound: z.boolean().default(true),
  notificationSoundUrl: z.string().url('Please enter a valid URL.').optional().or(z.literal('')),
  enableGuestReportSound: z.boolean().default(true),
  guestReportNotificationSoundUrl: z.string().url('Please enter a valid URL.').optional().or(z.literal('')),
});

type NotificationSettingsFormValues = z.infer<typeof notificationSettingsSchema>;

export function NotificationSettingsForm() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const { settings, isLoading: isSettingsLoading } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<NotificationSettingsFormValues>({
        resolver: zodResolver(notificationSettingsSchema),
        defaultValues: {
            enableNotificationSound: true,
            notificationSoundUrl: '',
            enableGuestReportSound: true,
            guestReportNotificationSoundUrl: '',
        },
    });

    const watchEnableOrderSound = form.watch('enableNotificationSound');
    const watchOrderSoundUrl = form.watch('notificationSoundUrl');
    const watchEnableGuestReportSound = form.watch('enableGuestReportSound');
    const watchGuestReportSoundUrl = form.watch('guestReportNotificationSoundUrl');

    React.useEffect(() => {
        if (settings) {
            form.reset({
                enableNotificationSound: settings.enableNotificationSound ?? true,
                notificationSoundUrl: settings.notificationSoundUrl || '',
                enableGuestReportSound: settings.enableGuestReportSound ?? true,
                guestReportNotificationSoundUrl: settings.guestReportNotificationSoundUrl || '',
            });
        }
    }, [settings, form]);

    const handleTestSound = (url?: string, defaultUrl?: string) => {
        const urlToTest = url || defaultUrl;
        if (!urlToTest) {
            toast({
                variant: 'destructive',
                title: 'No URL',
                description: 'Please provide a URL to test.',
            });
            return;
        }
        const audio = new Audio(urlToTest);
        audio.play()
            .then(() => {
                toast({
                    variant: 'success',
                    title: 'Sound Test Successful',
                    description: 'The notification sound played correctly.',
                });
            })
            .catch(error => {
                toast({
                    variant: 'destructive',
                    title: 'Sound Test Failed',
                    description: 'The URL does not point to a direct audio file. Please provide a direct link to a .mp3, .wav, or similar audio file.',
                    duration: 8000,
                });
            });
    };


    async function onSubmit(data: NotificationSettingsFormValues) {
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
                title: 'Notification Settings Updated',
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
                <CardContent className="space-y-4"><Skeleton className="h-24 w-full" /></CardContent>
                <CardFooter className="border-t px-6 py-4"><Skeleton className="h-10 w-40" /></CardFooter>
            </Card>
        );
    }

    return (
        <AccordionItem value="notifications">
            <Card>
                <AccordionTrigger className="p-6">
                     <div className="flex items-center gap-3">
                        <Bell className="h-6 w-6 text-muted-foreground" />
                        <div>
                            <CardTitle>Notification Settings</CardTitle>
                            <CardDescription className="text-left mt-1">Manage sound alerts for important events.</CardDescription>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-6 pt-0">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <fieldset disabled={isLoading} className="group">
                                <CardContent className="space-y-6 group-disabled:opacity-50">
                                    <div className="space-y-4 rounded-md border p-4">
                                        <FormField
                                            control={form.control}
                                            name="enableNotificationSound"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-base">Kitchen/Laundry Order Notification Sound</FormLabel>
                                                        <FormDescription>
                                                            Play a repeating sound when a new room service or laundry order is received.
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
                                        {watchEnableOrderSound && (
                                            <FormField control={form.control} name="notificationSoundUrl" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Order Sound URL</FormLabel>
                                                    <div className="flex items-center gap-2">
                                                        <FormControl>
                                                            <Input placeholder="https://example.com/sound.mp3" {...field} value={field.value || ''}/>
                                                        </FormControl>
                                                        <Button type="button" variant="outline" size="sm" onClick={() => handleTestSound(watchOrderSoundUrl, 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_16cc9a1f7d.mp3')}>
                                                            <Volume2 className="h-4 w-4 mr-2"/> Test
                                                        </Button>
                                                    </div>
                                                    <FormDescription>Enter a direct URL to a valid audio file (e.g., .mp3, .wav). Leave blank for default sound.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        )}
                                    </div>
                                    <div className="space-y-4 rounded-md border p-4 mt-4">
                                        <FormField
                                            control={form.control}
                                            name="enableGuestReportSound"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-base">Guest Report Notification Sound</FormLabel>
                                                        <FormDescription>
                                                            Play a repeating sound when a new report is submitted by a guest.
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
                                        {watchEnableGuestReportSound && (
                                            <FormField control={form.control} name="guestReportNotificationSoundUrl" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Guest Report Sound URL</FormLabel>
                                                    <div className="flex items-center gap-2">
                                                        <FormControl>
                                                            <Input placeholder="https://example.com/alert.mp3" {...field} value={field.value || ''}/>
                                                        </FormControl>
                                                        <Button type="button" variant="outline" size="sm" onClick={() => handleTestSound(watchGuestReportSoundUrl, 'https://cdn.pixabay.com/download/audio/2022/10/13/audio_8238140449.mp3')}>
                                                            <Volume2 className="h-4 w-4 mr-2" /> Test
                                                        </Button>
                                                    </div>
                                                    <FormDescription>Enter a direct URL for guest report alerts. Leave blank for default sound.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        )}
                                    </div>
                                </CardContent>
                                <CardFooter className="border-t px-6 py-4">
                                    <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Notification Settings
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
