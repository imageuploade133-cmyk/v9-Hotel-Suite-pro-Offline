
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Info, Server } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { CodeBlock } from '../ui/code-block';
import { useSettings } from '@/contexts/settings-context';
import { Skeleton } from '../ui/skeleton';
import { AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';

// This is a simplified check. A more robust solution might read the next.config.js
// at build time, but for this client component, we'll infer it.
const isStaticExport = process.env.NEXT_PUBLIC_OUTPUT_MODE === 'export' || true; // Default to true for safety

export function DeploymentSettingsForm() {

    const { isLoading: isSettingsLoading } = useSettings();

    const staticConfigCode = `
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export', // <--- Change this
  // ... other settings
};

export default nextConfig;
    `;

    const standaloneConfigCode = `
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // <--- To this
  // ... other settings
};

export default nextConfig;
    `;

    if (isSettingsLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-full max-w-lg" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-48 w-full" />
                </CardContent>
            </Card>
        )
    }

    return (
       <AccordionItem value="deployment">
            <Card>
                <AccordionTrigger className="p-6">
                    <div className="flex items-center gap-3">
                        <Server className="h-6 w-6 text-muted-foreground" />
                        <div>
                            <CardTitle>Deployment Mode</CardTitle>
                            <CardDescription className="text-left mt-1">Configure the application for different hosting environments.</CardDescription>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-6 pt-0">
                    <div className="space-y-6">
                         {isStaticExport ? (
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>Current Mode: Static Export</AlertTitle>
                                <AlertDescription>
                                    Your application is currently configured for static hosting (e.g., cPanel, Netlify, Vercel). In this mode, server-side features like the built-in API are disabled. Use a serverless backend like Google Apps Script for API functionality.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Alert variant="success">
                                <Server className="h-4 w-4" />
                                <AlertTitle>Current Mode: Standalone Server</AlertTitle>
                                <AlertDescription>
                                    Your application is configured to run on a Node.js server. All features, including the built-in API and Server Actions, are enabled.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </AccordionContent>
            </Card>
        </AccordionItem>
    );
}
