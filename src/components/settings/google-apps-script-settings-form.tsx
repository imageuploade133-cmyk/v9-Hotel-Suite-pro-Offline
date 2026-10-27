'use client';
import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { db } from '../../lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';

const formSchema = z.object({
  scriptUrl: z.string().url('Invalid URL').or(z.literal('')),
});

export function GoogleAppsScriptSettingsForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      scriptUrl: '',
    },
  });

  React.useEffect(() => {
    async function loadSettings() {
      try {
        const docRef = doc(db, 'settings', 'googleAppsScript');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          form.reset({
            scriptUrl: data.scriptUrl || '',
          });
        }
      } catch (error) {
        console.error('Error loading Google Apps Script settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'settings', 'googleAppsScript');
      await setDoc(docRef, values, { merge: true });
      toast({
        title: 'Settings saved',
        description: 'Google Apps Script URL has been updated successfully.',
      });
    } catch (error) {
      console.error('Error saving Google Apps Script settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save Google Apps Script settings.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Google Apps Script Settings</CardTitle>
          <CardDescription>
            Configure your Google Apps Script URL to handle backend actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-10 w-1/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Apps Script Settings</CardTitle>
        <CardDescription>
          Configure your Google Apps Script URL to handle backend actions (Server Actions replacement).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="scriptUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Script URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://script.google.com/macros/s/.../exec" {...field} />
                  </FormControl>
                  <FormDescription>
                    The Web App URL of your Google Apps Script.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
