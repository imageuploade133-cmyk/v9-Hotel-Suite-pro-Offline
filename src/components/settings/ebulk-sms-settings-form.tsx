'use client';
import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle, Send } from 'lucide-react';
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
  username: z.string().min(1, 'Username is required'),
  apiKey: z.string().min(1, 'API Key is required'),
});

export function EbulkSmsSettingsForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [testStatus, setTestStatus] = React.useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      apiKey: '',
    },
  });

  React.useEffect(() => {
    async function loadSettings() {
      try {
        const docRef = doc(db, 'settings', 'ebulkSms');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          form.reset({
            username: data.username || '',
            apiKey: data.apiKey || '',
          });
        }
      } catch (error) {
        console.error('Error loading EbulkSMS settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'settings', 'ebulkSms');
      await setDoc(docRef, values, { merge: true });
      toast({
        title: 'Settings saved',
        description: 'EbulkSMS credentials have been updated successfully.',
      });
      setTestStatus('idle');
    } catch (error) {
      console.error('Error saving EbulkSMS settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save EbulkSMS settings.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function testConnection() {
    setTestStatus('testing');
    try {
      const scriptDoc = await getDoc(doc(db, 'settings', 'googleAppsScript'));
      const scriptUrl = scriptDoc.data()?.scriptUrl;

      if (!scriptUrl) {
        toast({
          variant: 'destructive',
          title: 'Configuration Error',
          description: 'Google Apps Script URL is not configured. Please set it up first.',
        });
        setTestStatus('error');
        return;
      }

      const values = form.getValues();
      if (!values.username || !values.apiKey) {
        toast({
          variant: 'destructive',
          title: 'Missing Credentials',
          description: 'Please fill in both username and API key before testing.',
        });
        setTestStatus('error');
        return;
      }

      await setDoc(doc(db, 'settings', 'ebulkSms'), values, { merge: true });

      toast({
        title: 'Test Initiated',
        description: 'Credentials saved. Check the WhatsApp logs to verify the connection works when you send a message.',
      });
      setTestStatus('success');
    } catch (error: any) {
      console.error('Error testing connection:', error);
      toast({
        variant: 'destructive',
        title: 'Test Failed',
        description: error.message || 'Failed to test connection.',
      });
      setTestStatus('error');
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>EbulkSMS Settings</CardTitle>
          <CardDescription>
            Configure your EbulkSMS API credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
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
        <CardTitle>EbulkSMS Settings</CardTitle>
        <CardDescription>
          Configure your EbulkSMS API credentials.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="email@example.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your EbulkSMS username (email).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="API Key"
                        {...field}
                      />
                    </FormControl>
                    <div className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3">
                      {showApiKey ? (
                        <EyeOff
                          className="h-5 w-5 text-gray-400"
                          onClick={() => setShowApiKey(false)}
                        />
                      ) : (
                        <Eye
                          className="h-5 w-5 text-gray-400"
                          onClick={() => setShowApiKey(true)}
                        />
                      )}
                    </div>
                  </div>
                  <FormDescription>
                    Your EbulkSMS API Key.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isSaving || testStatus === 'testing'}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                disabled={isSaving || testStatus === 'testing'}
              >
                {testStatus === 'testing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {testStatus === 'success' && <CheckCircle className="mr-2 h-4 w-4 text-green-600" />}
                {testStatus === 'error' && <AlertCircle className="mr-2 h-4 w-4 text-red-600" />}
                {testStatus === 'idle' && <Send className="mr-2 h-4 w-4" />}
                {testStatus === 'testing' ? 'Testing...' : 'Save & Verify'}
              </Button>
            </div>
          </form>
        </Form>
        <div className="mt-4 space-y-3">
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>📝 Note:</strong> After saving, send a test WhatsApp message to verify the setup is working correctly.
              Check the WhatsApp History page to see if messages are delivered successfully.
            </p>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
              <strong>⚠️ Important:</strong> Before using WhatsApp messaging:
            </p>
            <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1 ml-4 list-disc">
              <li>Ensure your eBulkSMS account has sufficient credits</li>
              <li>Verify your WhatsApp Business number is connected to eBulkSMS (scan QR code in their dashboard)</li>
              <li>Phone numbers must include country code (e.g., 2348012345678 for Nigeria)</li>
              <li>Check Google Apps Script is deployed and URL is saved in Firestore</li>
            </ul>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>✅ Quick Test:</strong> Send a message to your own number first to verify everything works before sending to customers.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
