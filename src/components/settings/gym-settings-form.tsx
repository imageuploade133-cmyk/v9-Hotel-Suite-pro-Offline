
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Dumbbell, Save, MessageSquare, Bot, Loader2 } from 'lucide-react';
import { GymPlanManagement } from './gym-plan-management';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { doc, setDoc } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { useSettings } from '@/contexts/settings-context';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';

const gymSettingsSchema = z.object({
  gymReminderMessage: z.string().optional(),
});

type GymSettingsFormValues = z.infer<typeof gymSettingsSchema>;

const reminderTemplates = [
    {
        name: 'Friendly Reminder',
        template: "Hi {{MEMBER_NAME}},\n\nThis is a friendly reminder from {{BUSINESS_NAME}} that your gym membership is set to expire on {{EXPIRY_DATE}}. We'd love for you to continue your fitness journey with us!\n\nPlease visit the front desk to renew your membership at your earliest convenience.\n\nThank you,\n{{BUSINESS_NAME}} Team",
    },
    {
        name: 'Urgent Notice',
        template: "Hi {{MEMBER_NAME}},\n\nYour gym membership at {{BUSINESS_NAME}} expires on {{EXPIRY_DATE}}. Don't miss a day of your fitness journey! Renew today at the front desk to keep your access.\n\nThank you,\n{{BUSINESS_NAME}} Management",
    },
    {
        name: 'Benefit Focused',
        template: "Hello {{MEMBER_NAME}},\n\nYour access to all the great facilities at {{BUSINESS_NAME}} is about to expire on {{EXPIRY_DATE}}. Keep up your momentum and renew your membership to continue enjoying our services.\n\nStay fit!\nThe {{BUSINESS_NAME}} Team",
    },
];


export function GymSettingsForm() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const { settings, isLoading: isSettingsLoading } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [customTemplates, setCustomTemplates] = React.useState<{ name: string; template: string }[]>([]);

    const form = useForm<GymSettingsFormValues>({
        resolver: zodResolver(gymSettingsSchema),
        defaultValues: {
            gymReminderMessage: '',
        },
    });

     React.useEffect(() => {
        if (settings) {
            form.reset({
                gymReminderMessage: settings.gymReminderMessage || reminderTemplates[0].template,
            });
            if (settings.customReminderTemplates) {
                setCustomTemplates(settings.customReminderTemplates);
            }
        }
    }, [settings, form]);

    async function onSubmit(data: GymSettingsFormValues) {
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
            await setDoc(settingsDocRef, {
                ...data,
                customReminderTemplates: customTemplates
            }, { merge: true });

            toast({
                title: 'Gym Settings Updated',
                variant: 'success',
            });
            form.reset(data, { keepDirty: false });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to update settings.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }

    const handleGenerateAiMessage = async () => {
        const appsScriptUrl = settings?.aiScriptUrl;
        const appsScriptSecret = settings?.aiScriptSecret;

        if (!appsScriptUrl) {
            toast({
                variant: 'destructive',
                title: 'AI Script URL Not Configured',
                description: 'Please set the AI Script URL in the Integrations settings before using this feature.',
            });
            return;
        }

        setIsGenerating(true);
        try {
          const businessName = settings?.businessName || 'our gym';

          const response = await fetch(appsScriptUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              eventType: 'generate_reminder',
              businessName: businessName,
              secret: appsScriptSecret || '',
            })
          });

          const data = await response.json();

          if (!response.ok || data.status === 'error') {
            throw new Error(data.message || 'Failed to generate message from the AI server.');
          }

          form.setValue('gymReminderMessage', data.data.generatedMessage, { shouldDirty: true });
          toast({
            title: 'Message Generated!',
            description: 'A new reminder message has been generated by AI.',
            variant: 'success',
          });
        } catch (error: any) {
          toast({
            title: 'AI Generation Failed',
            description: error.message || 'Could not generate a new message. Please check the script URL and properties.',
            variant: 'destructive',
          });
        } finally {
          setIsGenerating(false);
        }
      };

    const handleSaveTemplate = () => {
        const message = form.getValues('gymReminderMessage');
        if (!message) {
            toast({
                title: 'Cannot Save Empty Template',
                variant: 'destructive',
            });
            return;
        }
        const newTemplateName = `Custom Template ${customTemplates.length + 1}`;
        const newTemplate = { name: newTemplateName, template: message };
        setCustomTemplates([...customTemplates, newTemplate]);
        toast({
            title: 'Template Saved',
            description: `"${newTemplateName}" has been added to your templates.`,
            variant: 'success',
        });
    };

    const isLoading = isSaving || isSettingsLoading;


    if (isSettingsLoading) {
         return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-full max-w-md" />
                </CardHeader>
                <CardContent className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></CardContent>
                <CardFooter className="border-t px-6 py-4"><Skeleton className="h-10 w-40" /></CardFooter>
            </Card>
        )
    }


  return (
    <AccordionItem value="gym-management">
        <Card>
            <AccordionTrigger className="p-6">
                 <div className="flex items-center gap-3">
                    <Dumbbell className="h-6 w-6 text-muted-foreground" />
                    <div>
                        <CardTitle>Gym Management</CardTitle>
                        <CardDescription className="text-left mt-1">
                        Manage membership plans and reminder message templates for the gym.
                        </CardDescription>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="p-6 pt-0">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <fieldset disabled={isLoading} className="group">
                            <CardContent className="space-y-6 group-disabled:opacity-50">
                                <GymPlanManagement />
                                <Separator />
                                <div>
                                    <h4 className="font-medium text-foreground mb-2 flex items-center gap-2"><MessageSquare className="h-5 w-5"/> Reminder Message Template</h4>
                                    <div className="space-y-4 rounded-md border p-4">
                                        <FormField
                                            control={form.control}
                                            name="gymReminderMessage"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <div className="flex items-center justify-between">
                                                    <FormLabel>Renewal Reminder Message</FormLabel>
                                                    <div className="flex items-center gap-2">
                                                        <Button variant="link" size="sm" type="button" onClick={handleGenerateAiMessage} disabled={isGenerating}>
                                                            <Bot className="h-4 w-4 mr-2" />
                                                            {isGenerating ? 'Generating...' : 'Generate with AI'}
                                                        </Button>
                                                        <Button variant="link" size="sm" type="button" onClick={handleSaveTemplate}>
                                                            <Save className="h-4 w-4 mr-2" />
                                                            Save as Template
                                                        </Button>
                                                    </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-xs text-muted-foreground">Select a template to start:</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {reminderTemplates.map(t => (
                                                                <Button key={t.name} type="button" variant="outline" size="sm" onClick={() => form.setValue('gymReminderMessage', t.template, { shouldDirty: true })}>
                                                                    <MessageSquare className="mr-2 h-4 w-4"/>
                                                                    {t.name}
                                                                </Button>
                                                            ))}
                                                            {customTemplates.map(t => (
                                                                <Button key={t.name} type="button" variant="outline" size="sm" onClick={() => form.setValue('gymReminderMessage', t.template, { shouldDirty: true })}>
                                                                    <MessageSquare className="mr-2 h-4 w-4"/>
                                                                    {t.name}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <FormControl>
                                                        <Textarea placeholder="Enter the message template..." {...field} rows={8} />
                                                    </FormControl>
                                                    <FormDescription>
                                                        Customize the message sent to members. Use placeholders: {"{{MEMBER_NAME}}"}, {"{{EXPIRY_DATE}}"}, {"{{BUSINESS_NAME}}"}.
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="border-t px-6 py-4">
                                <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Gym Settings
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
