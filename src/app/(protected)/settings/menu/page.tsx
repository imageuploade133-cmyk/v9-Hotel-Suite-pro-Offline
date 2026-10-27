'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Palette, RotateCcw, ArrowLeft } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';

const menuSettingsSchema = z.object({
  menuButtonColor: z.string().optional(),
  menuCartIconColor: z.string().optional(),
  menuActiveCategoryColor: z.string().optional(),
});

type MenuSettingsFormValues = z.infer<typeof menuSettingsSchema>;

const themes = [
    { name: 'Indigo & Teal', gradient: 'linear-gradient(to right, #3F51B5, #009688)' },
    { name: 'Emerald Green', gradient: 'linear-gradient(to right, #059669, #10B981)' },
    { name: 'Crimson Red', gradient: 'linear-gradient(to right, #B91C1C, #DC2626)' },
    { name: 'Goldenrod', gradient: 'linear-gradient(to right, #D97706, #F59E0B)' },
];


const ColorPicker = ({ field }: { field: any }) => (
  <div className="relative">
    <div className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border" style={{ background: field.value }} />
    <Input type="text" {...field} className="pl-10" />
    <Input
      type="color"
      value={field.value?.startsWith('linear-gradient') ? '#000000' : field.value}
      onChange={(e) => field.onChange(e.target.value)}
      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-10 cursor-pointer p-0 border-none bg-transparent"
    />
  </div>
);

const defaultValues = {
    menuButtonColor: 'linear-gradient(to right, #2563EB, #3B82F6)',
    menuCartIconColor: 'linear-gradient(to right, #2563EB, #3B82F6)',
    menuActiveCategoryColor: 'linear-gradient(to right, #2563EB, #3B82F6)',
};

export default function MenuSettingsPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const { settings, isLoading: isSettingsLoading } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<MenuSettingsFormValues>({
        resolver: zodResolver(menuSettingsSchema),
        defaultValues: defaultValues,
    });
    const { reset } = form;

    React.useEffect(() => {
        if (settings) {
            reset({
                menuButtonColor: settings.menuButtonColor || defaultValues.menuButtonColor,
                menuCartIconColor: settings.menuCartIconColor || defaultValues.menuCartIconColor,
                menuActiveCategoryColor: settings.menuActiveCategoryColor || defaultValues.menuActiveCategoryColor,
            });
        }
    }, [settings, reset]);

    const handleThemeSelect = (theme: typeof themes[0]) => {
        form.setValue('menuButtonColor', theme.gradient, { shouldDirty: true });
        form.setValue('menuCartIconColor', theme.gradient, { shouldDirty: true });
        form.setValue('menuActiveCategoryColor', theme.gradient, { shouldDirty: true });
    };

    async function onSubmit(data: MenuSettingsFormValues) {
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
                title: 'Settings Updated',
                description: 'Your menu settings have been saved.',
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

    const handleReset = () => {
        reset(defaultValues);
        toast({
            title: 'Form Reset',
            description: 'Settings have been reset to default. Click "Save Settings" to apply.',
        });
    };

    const isLoading = isSaving || isSettingsLoading;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/menus">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">Global Menu Appearance</h1>
                    <p className="text-muted-foreground">Customize the colors and themes of your online menus.</p>
                </div>
            </div>
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <fieldset disabled={isLoading} className="group">
                        <Accordion type="multiple" defaultValue={['appearance']} className="w-full space-y-4">
                             <AccordionItem value="appearance">
                               <Card>
                                <AccordionTrigger className="p-6">
                                    <div className="flex items-center gap-3">
                                        <Palette className="h-5 w-5 text-muted-foreground" />
                                        <h3 className="font-semibold">Appearance</h3>
                                    </div>
                                 </AccordionTrigger>
                                 <AccordionContent className="p-6 pt-0">
                                   <div className="space-y-6">
                                    <Card>
                                      <CardHeader>
                                        <CardTitle className="text-base">Quick Themes</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                              {themes.map(theme => (
                                                  <button
                                                      key={theme.name}
                                                      type="button"
                                                      onClick={() => handleThemeSelect(theme)}
                                                      className="flex flex-col items-center gap-2 p-2 rounded-md border-2 hover:border-primary transition-colors"
                                                  >
                                                      <div className="h-8 w-16 rounded-md border" style={{ background: theme.gradient }} />
                                                      <span className="text-xs font-medium">{theme.name}</span>
                                                  </button>
                                              ))}
                                          </div>
                                      </CardContent>
                                    </Card>

                                    <Card>
                                      <CardHeader>
                                          <CardTitle className="text-base">Custom Button Colors</CardTitle>
                                      </CardHeader>
                                      <CardContent className="space-y-4">
                                          {isLoading ? (
                                            <>
                                              <Skeleton className="h-20 w-full" />
                                              <Skeleton className="h-20 w-full" />
                                            </>
                                          ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                              <FormField
                                                  control={form.control}
                                                  name="menuActiveCategoryColor"
                                                  render={({ field }) => (
                                                      <FormItem>
                                                          <FormLabel>Active Category Button</FormLabel>
                                                          <FormControl>
                                                              <ColorPicker field={field} />
                                                          </FormControl>
                                                          <FormMessage />
                                                      </FormItem>
                                                  )}
                                              />
                                              <FormField
                                                  control={form.control}
                                                  name="menuButtonColor"
                                                  render={({ field }) => (
                                                      <FormItem>
                                                          <FormLabel>Add to Cart / Place Order Button</FormLabel>
                                                          <FormControl>
                                                              <ColorPicker field={field} />
                                                          </FormControl>
                                                          <FormMessage />
                                                      </FormItem>
                                                  )}
                                              />
                                              <FormField
                                                  control={form.control}
                                                  name="menuCartIconColor"
                                                  render={({ field }) => (
                                                      <FormItem>
                                                          <FormLabel>Floating Cart Button (Mobile)</FormLabel>
                                                          <FormControl>
                                                              <ColorPicker field={field} />
                                                          </FormControl>
                                                          <FormMessage />
                                                      </FormItem>
                                                  )}
                                              />
                                            </div>
                                          )}
                                      </CardContent>
                                    </Card>
                                  </div>
                                 </AccordionContent>
                               </Card>
                             </AccordionItem>
                        </Accordion>

                        <div className="flex justify-between items-center pt-6 border-t mt-6">
                            <Button variant="outline" onClick={handleReset} disabled={isLoading} type="button">
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reset to Default
                            </Button>
                            <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Settings
                            </Button>
                        </div>
                    </fieldset>
                </form>
            </Form>
        </div>
    );
}
