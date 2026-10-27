
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
import { Loader2, Palette } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { doc, setDoc } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { useSettings } from '@/contexts/settings-context';
import { Slider } from '../ui/slider';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';

const colorSchema = z.object({
  calendarVacantColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color'),
  calendarVacantTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color'),
  calendarCheckinColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color'),
  calendarCheckinTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color'),
  calendarCheckoutColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color'),
  calendarCheckoutTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color'),
  calendarReservationColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color'),
  calendarReservationTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color'),
  calendarColorOpacity: z.number().min(0).max(1),
  enableCalendarQuickBook: z.boolean().default(true),
});

type ColorFormValues = z.infer<typeof colorSchema>;

const ColorPicker = ({ field }: { field: any }) => (
  <div className="relative">
    <div className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border" style={{ backgroundColor: field.value }} />
    <Input type="text" {...field} className="pl-10" />
    <Input
      type="color"
      value={field.value || '#000000'}
      onChange={(e) => field.onChange(e.target.value)}
      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-10 cursor-pointer p-0 border-none bg-transparent"
    />
  </div>
);


export function CalendarColorForm() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const { settings, isLoading: isSettingsLoading } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<ColorFormValues>({
        resolver: zodResolver(colorSchema),
        defaultValues: {
            calendarVacantColor: '#22C55E',
            calendarVacantTextColor: '#FFFFFF',
            calendarCheckinColor: '#3B82F6',
            calendarCheckinTextColor: '#FFFFFF',
            calendarCheckoutColor: '#EF4444',
            calendarCheckoutTextColor: '#FFFFFF',
            calendarReservationColor: '#A855F7',
            calendarReservationTextColor: '#FFFFFF',
            calendarColorOpacity: 0.2,
            enableCalendarQuickBook: true,
        },
    });
    const { reset, watch } = form;

    React.useEffect(() => {
        if (settings) {
            reset({
                calendarVacantColor: settings.calendarVacantColor || '#22C55E',
                calendarVacantTextColor: settings.calendarVacantTextColor || '#FFFFFF',
                calendarCheckinColor: settings.calendarCheckinColor || '#3B82F6',
                calendarCheckinTextColor: settings.calendarCheckinTextColor || '#FFFFFF',
                calendarCheckoutColor: settings.calendarCheckoutColor || '#EF4444',
                calendarCheckoutTextColor: settings.calendarCheckoutTextColor || '#FFFFFF',
                calendarReservationColor: settings.calendarReservationColor || '#A855F7',
                calendarReservationTextColor: settings.calendarReservationTextColor || '#FFFFFF',
                calendarColorOpacity: settings.calendarColorOpacity ?? 0.2,
                enableCalendarQuickBook: settings.enableCalendarQuickBook ?? true,
            });
        }
    }, [settings, reset]);

    const opacityValue = watch('calendarColorOpacity');


    async function onSubmit(data: ColorFormValues) {
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
                title: 'Calendar Settings Updated',
                description: 'Your custom calendar settings have been saved.',
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
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
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
        <AccordionItem value="calendar-colors">
            <Card>
                <AccordionTrigger className="p-6">
                    <div className="flex items-center gap-3">
                        <Palette className="h-6 w-6 text-muted-foreground" />
                        <div>
                            <CardTitle>Calendar Colors</CardTitle>
                            <CardDescription className="text-left mt-1">Customize the indicator colors of the booking availability calendar.</CardDescription>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-6 pt-0">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <fieldset disabled={isLoading} className="group">
                                <CardContent className="space-y-6 group-disabled:opacity-50">
                                    <FormField
                                        control={form.control}
                                        name="enableCalendarQuickBook"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">Quick-Book Popover</FormLabel>
                                                <FormDescription>
                                                Enable a popover with booking options when clicking a vacant date.
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
                                    <FormField
                                        control={form.control}
                                        name="calendarColorOpacity"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Color Opacity</FormLabel>
                                                <div className="flex items-center gap-4">
                                                    <FormControl>
                                                        <Slider
                                                            min={0}
                                                            max={1}
                                                            step={0.05}
                                                            value={[field.value]}
                                                            onValueChange={(value) => field.onChange(value[0])}
                                                        />
                                                    </FormControl>
                                                    <div className="font-semibold w-20 text-center text-sm tabular-nums">
                                                        {Math.round(opacityValue * 100)}%
                                                    </div>
                                                </div>
                                                <FormDescription>Controls the transparency of all calendar status colors.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Separator />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                                        <FormField
                                        control={form.control}
                                        name="calendarVacantColor"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Vacant / Available</FormLabel>
                                            <FormControl><ColorPicker field={field} /></FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                        <FormField
                                        control={form.control}
                                        name="calendarVacantTextColor"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Vacant Text Color</FormLabel>
                                            <FormControl><ColorPicker field={field} /></FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                        <FormField
                                        control={form.control}
                                        name="calendarCheckinColor"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Check-in / Active Stay</FormLabel>
                                            <FormControl><ColorPicker field={field} /></FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                        <FormField
                                        control={form.control}
                                        name="calendarCheckinTextColor"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Check-in Text Color</FormLabel>
                                            <FormControl><ColorPicker field={field} /></FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                        <FormField
                                        control={form.control}
                                        name="calendarCheckoutColor"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Check-out Day</FormLabel>
                                            <FormControl><ColorPicker field={field} /></FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                        <FormField
                                        control={form.control}
                                        name="calendarCheckoutTextColor"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Check-out Text Color</FormLabel>
                                            <FormControl><ColorPicker field={field} /></FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                        <FormField
                                        control={form.control}
                                        name="calendarReservationColor"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Reservation</FormLabel>
                                            <FormControl><ColorPicker field={field} /></FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                        <FormField
                                        control={form.control}
                                        name="calendarReservationTextColor"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Reservation Text Color</FormLabel>
                                            <FormControl><ColorPicker field={field} /></FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter className="border-t px-6 py-4">
                                    <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Settings
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
