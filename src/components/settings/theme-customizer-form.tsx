
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
import { Loader2, Palette, RotateCcw, Paintbrush, Circle, Hand, AlertTriangle } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { doc, setDoc } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { useSettings } from '@/contexts/settings-context';
import { Separator } from '../ui/separator';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: 'Must be a valid hex color' }).optional().or(z.literal(''));

const themeSchema = z.object({
  light: z.object({
    background: colorSchema,
    foreground: colorSchema,
    card: colorSchema,
    cardForeground: colorSchema,
    popover: colorSchema,
    popoverForeground: colorSchema,
    primary: colorSchema,
    primaryForeground: colorSchema,
    secondary: colorSchema,
    secondaryForeground: colorSchema,
    muted: colorSchema,
    mutedForeground: colorSchema,
    accent: colorSchema,
    accentForeground: colorSchema,
    destructive: colorSchema,
    destructiveForeground: colorSchema,
    success: colorSchema,
    successForeground: colorSchema,
    border: colorSchema,
    input: colorSchema,
    ring: colorSchema,
  }),
  dark: z.object({
    background: colorSchema,
    foreground: colorSchema,
    card: colorSchema,
    cardForeground: colorSchema,
    popover: colorSchema,
    popoverForeground: colorSchema,
    primary: colorSchema,
    primaryForeground: colorSchema,
    secondary: colorSchema,
    secondaryForeground: colorSchema,
    muted: colorSchema,
    mutedForeground: colorSchema,
    accent: colorSchema,
    accentForeground: colorSchema,
    destructive: colorSchema,
    destructiveForeground: colorSchema,
    success: colorSchema,
    successForeground: colorSchema,
    border: colorSchema,
    input: colorSchema,
    ring: colorSchema,
  }),
});

type ThemeFormValues = z.infer<typeof themeSchema>;

const ColorPicker = ({ field, label }: { field: any, label: string }) => (
  <FormItem>
    <FormLabel>{label}</FormLabel>
    <div className="relative">
        <div className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border" style={{ backgroundColor: field.value }} />
        <Input type="text" {...field} value={field.value || ''} className="pl-10" />
        <Input
            type="color"
            value={field.value || '#000000'}
            onChange={(e) => field.onChange(e.target.value)}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-10 cursor-pointer p-0 border-none bg-transparent"
        />
    </div>
    <FormMessage />
  </FormItem>
);

const defaultValues: ThemeFormValues = {
    light: {
        background: '#f5f5f5',
        foreground: '#1A237E',
        card: '#FFFFFF',
        cardForeground: '#1A237E',
        popover: '#FFFFFF',
        popoverForeground: '#1A237E',
        primary: '#1A237E',
        primaryForeground: '#FFFFFF',
        secondary: '#E8EAF6',
        secondaryForeground: '#1A237E',
        muted: '#F5F5F5',
        mutedForeground: '#5C6BC0',
        accent: '#FFC107',
        accentForeground: '#212121',
        destructive: '#D32F2F',
        destructiveForeground: '#FFFFFF',
        success: '#2E7D32',
        successForeground: '#FFFFFF',
        border: '#C5CAE9',
        input: '#C5CAE9',
        ring: '#3949AB',
    },
    dark: {
        background: '#121212',
        foreground: '#E8EAF6',
        card: '#1E1E1E',
        cardForeground: '#E8EAF6',
        popover: '#212121',
        popoverForeground: '#E8EAF6',
        primary: '#7986CB',
        primaryForeground: '#FFFFFF',
        secondary: '#2a2a2a',
        secondaryForeground: '#E8EAF6',
        muted: '#2a2a2a',
        mutedForeground: '#9FA8DA',
        accent: '#FFCA28',
        accentForeground: '#000000',
        destructive: '#E57373',
        destructiveForeground: '#000000',
        success: '#A5D6A7',
        successForeground: '#000000',
        border: '#303F9F',
        input: '#303F9F',
        ring: '#7986CB',
    }
};

export function ThemeCustomizerForm() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const { settings, isLoading: isSettingsLoading } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<ThemeFormValues>({
        resolver: zodResolver(themeSchema),
        defaultValues: defaultValues,
    });
    const { reset } = form;

    React.useEffect(() => {
        if (settings?.theme) {
            form.reset({
                light: { ...defaultValues.light, ...settings.theme.light },
                dark: { ...defaultValues.dark, ...settings.theme.dark },
            });
        }
    }, [settings, reset]);


    async function onSubmit(data: ThemeFormValues) {
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
            const settingsDocRef = doc(firestore, 'themes', 'global');
            await setDoc(settingsDocRef, data, { merge: true });

            toast({
                title: 'Theme Updated',
                description: 'Your new color theme has been applied.',
                variant: 'success',
            });
             form.reset(data, { keepDirty: false });
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to update theme.',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    }

    const handleReset = async () => {
        if (!user || !firestore) {
            toast({ title: 'Error', description: 'Authentication not ready.', variant: 'destructive' });
            return;
        }

        setIsSaving(true);
        try {
            const settingsDocRef = doc(firestore, 'themes', 'global');
            await setDoc(settingsDocRef, defaultValues, { merge: true });
            form.reset(defaultValues);
            toast({
                title: 'Theme Reset',
                description: 'The theme has been reset to its default values and saved.',
                variant: 'success',
            });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const renderColorPickers = (theme: 'light' | 'dark', keys: (keyof ThemeFormValues['light'])[]) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {keys.map((key) => (
                <FormField
                    key={`${theme}-${key}`}
                    control={form.control}
                    name={`${theme}.${key}`}
                    render={({ field }) => (
                        <ColorPicker
                            field={field}
                            label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        />
                    )}
                />
            ))}
        </div>
    );

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
        <Accordion type="single" collapsible defaultValue='theme-customizer' className="w-full">
            <AccordionItem value="theme-customizer">
                <Card>
                    <AccordionTrigger className="p-6">
                        <div className="flex items-center gap-3">
                            <Palette className="h-6 w-6 text-muted-foreground" />
                            <div>
                                <CardTitle>Theme Customizer</CardTitle>
                                <CardDescription className="text-left mt-1">Customize the color scheme of the application.</CardDescription>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-6 pt-0">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)}>
                                <fieldset disabled={isLoading} className="group">
                                    <CardContent className="space-y-8 group-disabled:opacity-50">
                                         <Accordion type="multiple" defaultValue={['light-core', 'dark-core']} className="w-full space-y-4">
                                            <Card>
                                                <AccordionItem value="light-theme">
                                                    <AccordionTrigger className="p-4"><h4 className="text-lg font-semibold">Light Mode</h4></AccordionTrigger>
                                                    <AccordionContent className="p-4 space-y-6">
                                                         <div className="space-y-4">
                                                            <h5 className="font-semibold flex items-center gap-2"><Circle className="h-4 w-4"/> Core Palette</h5>
                                                            {renderColorPickers('light', ['background', 'foreground', 'border', 'input', 'ring'])}
                                                         </div>
                                                         <Separator/>
                                                         <div className="space-y-4">
                                                            <h5 className="font-semibold flex items-center gap-2"><Hand className="h-4 w-4"/> Primary & Secondary Colors</h5>
                                                            {renderColorPickers('light', ['primary', 'primaryForeground', 'secondary', 'secondaryForeground'])}
                                                         </div>
                                                          <Separator/>
                                                         <div className="space-y-4">
                                                            <h5 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4"/> Notifications & Status Colors</h5>
                                                            {renderColorPickers('light', ['accent', 'accentForeground', 'destructive', 'destructiveForeground', 'success', 'successForeground'])}
                                                         </div>
                                                          <Separator/>
                                                         <div className="space-y-4">
                                                            <h5 className="font-semibold flex items-center gap-2"><Paintbrush className="h-4 w-4"/> Component Colors</h5>
                                                            {renderColorPickers('light', ['card', 'cardForeground', 'popover', 'popoverForeground', 'muted', 'mutedForeground'])}
                                                         </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </Card>
                                             <Card>
                                                <AccordionItem value="dark-theme">
                                                    <AccordionTrigger className="p-4"><h4 className="text-lg font-semibold">Dark Mode</h4></AccordionTrigger>
                                                    <AccordionContent className="p-4 space-y-6">
                                                         <div className="space-y-4">
                                                            <h5 className="font-semibold flex items-center gap-2"><Circle className="h-4 w-4"/> Core Palette</h5>
                                                            {renderColorPickers('dark', ['background', 'foreground', 'border', 'input', 'ring'])}
                                                         </div>
                                                         <Separator/>
                                                         <div className="space-y-4">
                                                            <h5 className="font-semibold flex items-center gap-2"><Hand className="h-4 w-4"/> Primary & Secondary Colors</h5>
                                                            {renderColorPickers('dark', ['primary', 'primaryForeground', 'secondary', 'secondaryForeground'])}
                                                         </div>
                                                          <Separator/>
                                                         <div className="space-y-4">
                                                            <h5 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4"/> Notifications & Status Colors</h5>
                                                            {renderColorPickers('dark', ['accent', 'accentForeground', 'destructive', 'destructiveForeground', 'success', 'successForeground'])}
                                                         </div>
                                                          <Separator/>
                                                         <div className="space-y-4">
                                                            <h5 className="font-semibold flex items-center gap-2"><Paintbrush className="h-4 w-4"/> Component Colors</h5>
                                                            {renderColorPickers('dark', ['card', 'cardForeground', 'popover', 'popoverForeground', 'muted', 'mutedForeground'])}
                                                         </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </Card>
                                         </Accordion>
                                    </CardContent>
                                    <CardFooter className="border-t px-6 py-4 flex justify-between">
                                        <Button variant="outline" onClick={handleReset} disabled={isLoading} type="button">
                                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Reset to Default
                                        </Button>
                                        <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
                                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Save Theme
                                        </Button>
                                    </CardFooter>
                                </fieldset>
                            </form>
                        </Form>
                    </AccordionContent>
                </Card>
            </AccordionItem>
        </Accordion>
    );
}
