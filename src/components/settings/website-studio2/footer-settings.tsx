
'use client';

import * as React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Info } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

interface FooterSettingsFormProps {
    form: UseFormReturn<any>;
    sectionId: string;
}

export function FooterSettingsForm({
    form,
    sectionId,
}: FooterSettingsFormProps) {
    const fieldName = 'websiteData.footer';

    return (
        <AccordionItem value={sectionId}>
            <Card>
                <AccordionTrigger className="p-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Info className="h-5 w-5" />
                        Footer Section
                    </h3>
                </AccordionTrigger>
                <AccordionContent className="p-4 pt-0 space-y-4">
                    <FormField
                        control={form.control}
                        name={`${fieldName}.description`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl><Textarea {...field} value={field.value ?? ""} rows={3} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`${fieldName}.newsletterTitle`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Newsletter Title</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`${fieldName}.copyrightText`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Copyright Text</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </AccordionContent>
            </Card>
        </AccordionItem>
    );
}
