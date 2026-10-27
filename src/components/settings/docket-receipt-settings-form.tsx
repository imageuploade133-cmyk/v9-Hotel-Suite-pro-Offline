'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '../ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useSettings } from '@/contexts/settings-context';
import { doc, setDoc } from 'firebase/firestore';

const docketSettingsSchema = z.object({
  deductionReceiptTitle: z.string().optional(),
  deductionReceiptFooter: z.string().optional(),
});

type DocketSettingsFormValues = z.infer<typeof docketSettingsSchema>;

const defaultValues = {
  deductionReceiptTitle: 'Salary Deduction / Advance',
  deductionReceiptFooter: 'This is an official receipt for salary advance/deduction.',
};

export function DocketReceiptSettingsForm() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { settings, isLoading } = useSettings();

  const form = useForm<DocketSettingsFormValues>({
    resolver: zodResolver(docketSettingsSchema),
    defaultValues: defaultValues,
  });

  React.useEffect(() => {
    if (settings) {
      form.reset({
        deductionReceiptTitle: settings.deductionReceiptTitle || defaultValues.deductionReceiptTitle,
        deductionReceiptFooter: settings.deductionReceiptFooter || defaultValues.deductionReceiptFooter,
      });
    }
  }, [settings, form]);

  async function onSubmit(data: DocketSettingsFormValues) {
    if (!firestore) return;

    try {
      const settingsDocRef = doc(firestore, 'settings', 'global');
      await setDoc(settingsDocRef, data, { merge: true });
      toast({
        variant: 'success',
        title: 'Settings Saved',
        description: 'Deduction receipt text has been updated.',
      });
      form.reset(data, { keepDirty: false });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save settings.',
      });
    }
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Deduction/Advance Receipt Text</h4>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="deductionReceiptTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Receipt Title</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., Salary Advance Receipt" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="deductionReceiptFooter"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Receipt Footer Text</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.formState.isDirty && (
            <Button type="submit" disabled={isLoading}>Save</Button>
          )}
        </form>
      </Form>
    </div>
  );
}
