
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { FormProvider, useFormContext } from 'react-hook-form';
import { WebsitePageClient } from './client-page';
import { useSettings } from '@/contexts/settings-context';
import type { SiteData } from './types';
import { PreviewProvider } from './preview-provider';

type Device = 'mobile' | 'tablet' | 'desktop';

export function WebsitePreview({ pageData }: { pageData: SiteData }) {
    const [device, setDevice] = React.useState<Device>('desktop');
    const [iframeKey, setIframeKey] = React.useState(Date.now());

    const deviceWidths: Record<Device, string> = {
        mobile: '375px',
        tablet: '768px',
        desktop: '100%',
    };

    const handleRefresh = () => {
        setIframeKey(Date.now());
    };

    return (
        <div className="bg-muted dark:bg-slate-900/50 rounded-2xl shadow-lg h-full flex flex-col border">
           <div className="flex items-center justify-between p-2 border-b">
               <div className="flex items-center gap-1">
                   {['mobile', 'tablet', 'desktop'].map((d) => (
                       <Button key={d} variant={device === d ? 'secondary' : 'ghost'} size="sm" onClick={() => setDevice(d as Device)}>
                           {d.charAt(0).toUpperCase() + d.slice(1)}
                       </Button>
                   ))}
               </div>
                <Button variant="ghost" size="sm" onClick={handleRefresh}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Preview
                </Button>
           </div>
            <div className="flex-1 p-4 flex items-center justify-center overflow-auto">
                 <div
                    className="relative h-full bg-background shadow-lg rounded-md transition-all duration-300 border-4 border-foreground/20"
                    style={{ width: deviceWidths[device] }}
                >
                    <div className="absolute inset-0">
                       <PreviewProvider pageData={pageData}>
                            <WebsitePageClient pageData={pageData} isStudio={true} />
                        </PreviewProvider>
                    </div>
                </div>
            </div>
        </div>
    );
}
