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
import { Loader2, Package, Phone } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { doc, setDoc } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { useSettings } from '@/contexts/settings-context';
import { AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';
import { Switch } from '../ui/switch';

const inventoryPolicySchema = z.object({
  stockAlertPhoneNumber: z.string().optional(),
  allowManualStockEdit: z.boolean().default(true),
  autoDeductStockOnSale: z.boolean().default(true),
});

type InventoryPolicyFormValues = z.infer<typeof inventoryPolicySchema>;

export function InventoryPolicyForm() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const { settings, isLoading: isSettingsLoading } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<InventoryPolicyFormValues>({
        resolver: zodResolver(inventoryPolicySchema),
        defaultValues: {
            stockAlertPhoneNumber: '',
            allowManualStockEdit: true,
            autoDeductStockOnSale: true,
        },
    });

    React.useEffect(() => {
        if (settings) {
            form.reset({
                stockAlertPhoneNumber: settings.stockAlertPhoneNumber || '',
                allowManualStockEdit: settings.allowManualStockEdit ?? true,
                autoDeductStockOnSale: settings.autoDeductStockOnSale ?? true,
            });
        }
    }, [settings, form]);


    async function onSubmit(data: InventoryPolicyFormValues) {
        if (!user || !firestore) {
            toast({ title: 'Error', description: 'User must be logged in to update settings.', variant: 'destructive' });
            return;
        }

        setIsSaving(true);
        try {
            const settingsDocRef = doc(firestore, 'settings', 'global');
            await setDoc(settingsDocRef, data, { merge: true });

            toast({ title: 'Inventory Policy Updated', variant: 'success' });
            form.reset(data, { keepDirty: false });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to update settings.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }

    if (isSettingsLoading) {
        return (
           <Card>
               <CardHeader><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-full max-w-lg" /></CardHeader>
               <CardContent className="space-y-4"><Skeleton className="h-20 w-full" /></CardContent>
               <CardFooter className="border-t px-6 py-4"><Skeleton className="h-10 w-40" /></CardFooter>
           </Card>
       )
   }

    return (
        <AccordionItem value="inventory-policy">
            <Card>
                <AccordionTrigger className="p-6">
                    <div className="flex items-center gap-3">
                        <Package className="h-6 w-6 text-muted-foreground" />
                        <div>
                            <CardTitle>Inventory Policy</CardTitle>
                            <CardDescription className="text-left mt-1">Control how stock is managed across the application.</CardDescription>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-6 pt-0">
                     <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <fieldset disabled={isSaving || isSettingsLoading} className="group">
                                <CardContent className="space-y-6 group-disabled:opacity-50">
                                     <FormField
                                        control={form.control}
                                        name="stockAlertPhoneNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Stock Alert Phone Number</FormLabel>
                                                <div className="relative">
                                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <FormControl><Input placeholder="e.g., +1234567890" className="pl-10" {...field} value={field.value || ''} /></FormControl>
                                                </div>
                                                <FormDescription>WhatsApp number to receive low/out-of-stock alerts.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="autoDeductStockOnSale"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base">Auto-Deduct Stock</FormLabel>
                                                    <FormDescription>Automatically decrease stock quantity when an item is sold via the POS.</FormDescription>
                                                </div>
                                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="allowManualStockEdit"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base">Allow Manual Stock Editing</FormLabel>
                                                    <FormDescription>Allow direct editing of stock quantities from the main inventory table.</FormDescription>
                                                </div>
                                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                                <CardFooter className="border-t px-6 py-4">
                                    <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
                                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Inventory Policy
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
