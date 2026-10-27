
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '../ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Languages, Loader2 } from 'lucide-react';
import { countries, currencies } from '@/lib/countries';
import { useFirestore } from '@/firebase';
import { doc, setDoc, writeBatch, collection, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';

const localizationSchema = z.object({
    country: z.string().nonempty({ message: 'Country is required.' }),
    currency: z.string().nonempty({ message: 'Currency is required.' }),
    customCountry: z.string().optional(),
    customCurrency: z.string().optional(),
    customPhoneCode: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.country === 'OTHER') {
        if (!data.customCountry) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Custom country name is required.',
                path: ['customCountry'],
            });
        }
    }
    if (data.currency === 'OTHER') {
        if (!data.customCurrency) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Custom currency code is required.',
                path: ['customCurrency'],
            });
        } else if (data.customCurrency.length !== 3) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Currency code must be 3 letters.',
                path: ['customCurrency'],
            });
        }
    }
});


type LocalizationFormValues = z.infer<typeof localizationSchema>;

export function LocalizationForm() {
    const { toast } = useToast();
    const { user, userProfile } = useUser();
    const firestore = useFirestore();
    const { settings, isLoading: isSettingsLoading } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<LocalizationFormValues>({
        resolver: zodResolver(localizationSchema),
        defaultValues: {
            country: '',
            currency: '',
            customCountry: '',
            customCurrency: '',
            customPhoneCode: '',
        },
    });
    const { reset, setValue, formState } = form;

    React.useEffect(() => {
        if (settings) {
            const isCustomCountry = !countries.some(c => c.code === settings.country);
            const isCustomCurrency = !Object.keys(currencies).includes(settings.currency || '');

            reset({
                country: isCustomCountry ? 'OTHER' : settings.country || 'US',
                currency: isCustomCurrency ? 'OTHER' : settings.currency || 'USD',
                customCountry: isCustomCountry ? settings.country : '',
                customCurrency: isCustomCurrency ? settings.currency : '',
                customPhoneCode: isCustomCountry ? settings.countryCode : '',
            });
        }
    }, [settings, reset]);


    const selectedCountryCode = form.watch('country');
    const selectedCurrencyCode = form.watch('currency');

    React.useEffect(() => {
        if (selectedCountryCode && selectedCountryCode !== 'OTHER' && formState.dirtyFields.country) {
            const country = countries.find(c => c.code === selectedCountryCode);
            if (country) {
                if (country.currency) setValue('currency', country.currency, { shouldDirty: true });
                if (country.phoneCode) setValue('customPhoneCode', country.phoneCode, { shouldDirty: true });
            }
        }
    }, [selectedCountryCode, setValue, formState.dirtyFields.country]);

    async function onSubmit(data: LocalizationFormValues) {
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

            const countryData = countries.find(c => c.code === data.country);
            let countryToSave = data.country === 'OTHER' ? data.customCountry! : data.country;
            let currencyToSave = data.currency === 'OTHER' ? data.customCurrency!.toUpperCase() : data.currency!;
            let phoneCodeToSave = data.country === 'OTHER' ? data.customPhoneCode : countryData?.phoneCode;

            const settingsToSave = {
                country: countryToSave,
                currency: currencyToSave,
                countryCode: phoneCodeToSave,
            };

            const changes = [];
            if (settings?.country !== countryToSave) changes.push({ field: 'country', before: settings?.country ?? null, after: countryToSave });
            if (settings?.currency !== currencyToSave) changes.push({ field: 'currency', before: settings?.currency ?? null, after: currencyToSave });
            if (settings?.countryCode !== phoneCodeToSave) changes.push({ field: 'countryCode', before: settings?.countryCode ?? null, after: phoneCodeToSave });

            if (changes.length > 0) {
                batch.set(settingsDocRef, settingsToSave, { merge: true });

                const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
                batch.set(auditLogRef, {
                    timestamp: serverTimestamp(),
                    userId: userProfile.uid,
                    userName: userProfile.name,
                    changeType: 'Update',
                    entityType: 'Settings',
                    entityId: 'Localization',
                    details: 'Updated currency and region settings.',
                    changes,
                });

                await batch.commit();
            }

            const countryName = data.country === 'OTHER' ? data.customCountry : countries.find(c => c.code === data.country)?.name;

            toast({
                title: 'Global Settings Updated',
                description: `Default country set to ${countryName} and currency to ${currencyToSave}.`,
                variant: 'success',
            });
            reset(data, { keepDirty: false });
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
        <AccordionItem value="currency-region">
            <Card>
                <AccordionTrigger className="p-6">
                    <div className="flex items-center gap-3">
                        <Languages className="h-6 w-6 text-muted-foreground" />
                        <div>
                            <CardTitle>Currency & Region</CardTitle>
                            <CardDescription className="text-left mt-1">Set the global default country and currency for the application.</CardDescription>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-6 pt-0">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <fieldset disabled={isLoading} className="group">
                                <CardContent className="space-y-4 group-disabled:opacity-50">
                                    <FormField
                                        control={form.control}
                                        name="country"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Default Country</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a country" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {countries.map((country) => (
                                                            <SelectItem key={country.code} value={country.code}>
                                                                {country.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {selectedCountryCode === 'OTHER' && (
                                        <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="customCountry"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Custom Country Name</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Enter country name" {...field} value={field.value || ''} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="customPhoneCode"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Phone Code</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="e.g. +44" {...field} value={field.value || ''} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        </div>
                                    )}
                                    <FormField
                                        control={form.control}
                                        name="currency"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Global Currency</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a currency" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {Object.entries(currencies).map(([code, currency]) => (
                                                            <SelectItem key={code} value={code}>
                                                                {currency.name} ({code})
                                                            </SelectItem>
                                                        ))}
                                                        <SelectItem value="OTHER">Other...</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormDescription>This currency will be used for all financial values across the app.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {selectedCurrencyCode === 'OTHER' && (
                                        <FormField
                                            control={form.control}
                                            name="customCurrency"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Custom Currency Code (3 Letters)</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="e.g., AUD" {...field} maxLength={3} value={field.value || ''} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </CardContent>
                                <CardFooter className="border-t px-6 py-4">
                                    <Button type="submit" disabled={isLoading || !formState.isDirty}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Global Settings
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
