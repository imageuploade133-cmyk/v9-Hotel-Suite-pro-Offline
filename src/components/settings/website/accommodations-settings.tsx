
'use client';

import * as React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { BedDouble } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface AccommodationsSettingsFormProps {
    form: UseFormReturn<any>;
    sectionId: string;
}

export function AccommodationsSettingsForm({
    form,
    sectionId,
}: AccommodationsSettingsFormProps) {
    const fieldName = 'websiteData.accommodations';
    const roomSource = form.watch(`${fieldName}.roomSource`);

    return (
        <AccordionItem value={sectionId}>
            <Card>
                <AccordionTrigger className="p-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <BedDouble className="h-5 w-5" />
                        Accommodations Section
                    </h3>
                </AccordionTrigger>
                <AccordionContent className="p-4 pt-0 space-y-4">
                    <FormField
                        control={form.control}
                        name={`${fieldName}.show`}
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5"><FormLabel>Show Section</FormLabel></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`${fieldName}.title`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Title</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`${fieldName}.subtitle`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Subtitle</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`${fieldName}.roomSource`}
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                            <FormLabel>Room Source</FormLabel>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-1">
                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl><RadioGroupItem value="all" /></FormControl>
                                        <FormLabel className="font-normal">All Rooms</FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl><RadioGroupItem value="signature" /></FormControl>
                                        <FormLabel className="font-normal">Signature Rooms Only</FormLabel>
                                    </FormItem>
                                </RadioGroup>
                            </FormControl>
                            </FormItem>
                        )}
                    />
                </AccordionContent>
            </Card>
        </AccordionItem>
    );
}
