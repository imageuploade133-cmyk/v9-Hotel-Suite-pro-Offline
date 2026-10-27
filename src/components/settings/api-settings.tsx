
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Loader2, Globe } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';

export function ApiSettingsForm({ form, onPartialSubmit, isSaving, sectionId }: { form: any, onPartialSubmit: any, isSaving: boolean, sectionId: string }) {

    return (
        <AccordionItem value={sectionId}>
            <Card>
                <AccordionTrigger className="p-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        API Integrations
                    </h3>
                </AccordionTrigger>
                <AccordionContent className="p-4 pt-0 space-y-4">
                    {/* Content will be added in a future step */}
                    <p className="text-sm text-muted-foreground p-4 text-center">API integration settings will be available here in a future update.</p>
                </AccordionContent>
                <CardFooter className="border-t p-4 flex justify-end">
                    <Button type="button" onClick={onPartialSubmit} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Section
                    </Button>
                </CardFooter>
            </Card>
        </AccordionItem>
    );
}
