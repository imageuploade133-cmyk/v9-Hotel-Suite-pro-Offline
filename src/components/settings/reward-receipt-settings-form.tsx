'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useSettings } from '@/contexts/settings-context';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const rewardSettingsSchema = z.object({
  rewardReceiptTitle: z.string().optional(),
  rewardReceiptFooter: z.string().optional(),
});

type RewardSettingsFormValues = z.infer<typeof rewardSettingsSchema>;

const defaultValues = {
  rewardReceiptTitle: 'Staff Reward / Bonus',
  rewardReceiptFooter: 'This is an official receipt.',
};

export function RewardReceiptSettingsForm() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { settings, isLoading } = useSettings();

  const form = useForm<RewardSettingsFormValues>({
    resolver: zodResolver(rewardSettingsSchema),
    defaultValues: defaultValues,
  });

  React.useEffect(() => {
    if (settings) {
      form.reset({
        rewardReceiptTitle: settings.rewardReceiptTitle || defaultValues.rewardReceiptTitle,
        rewardReceiptFooter: settings.rewardReceiptFooter || defaultValues.rewardReceiptFooter,
      });
    }
  }, [settings, form]);

  async function onSubmit(data: RewardSettingsFormValues) {
    if (!firestore) return;

    try {
      const settingsDocRef = doc(firestore, 'settings', 'global');
      await setDoc(settingsDocRef, data, { merge: true });
      toast({
        variant: 'success',
        title: 'Settings Saved',
        description: 'Reward receipt text has been updated.',
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
      <h4 className="font-medium">Reward/Bonus Receipt Text</h4>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="rewardReceiptTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Receipt Title</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., Staff Bonus" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="rewardReceiptFooter"
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
