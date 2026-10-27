
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { WebsitePageClient } from '../website/client-page';
import { useSettings } from '@/contexts/settings-context';
import type { SiteData } from '../website/types';

type Device = 'mobile' | 'tablet' | 'desktop';

export function WebsitePreview() {
    const [device, setDevice] = React.useState<Device>('desktop');
    const [iframeKey, setIframeKey] = React.useState(Date.now());
    const [isLoading, setIsLoading] = React.useState(true);
    const { settings } = useSettings();
    const { watch } = useFormContext();

    const watchedData = watch('websiteData');

    const livePageData = React.useMemo(() => {
        // This is where you would merge the form data with your fetched pageData
        // For now, we'll just pass a placeholder
        const baseData: Partial<SiteData> = {
            signatureRooms: [],
            allRooms: [],
            reviews: [],
            amenities: [],
        };
        return {
            ...baseData,
            settings: {
                ...settings,
                websiteData: watchedData
            }
        }
    }, [watchedData, settings]);

    const deviceWidths: Record<Device, string> = {
        mobile: '375px',
        tablet: '768px',
        desktop: '100%',
    };

    const handleRefresh = () => {
        setIsLoading(true);
        setIframeKey(Date.now());
    };

    // The WebsitePageClient now needs to be wrapped in a FormProvider
    // but since it's inside an iframe, we need to pass data differently or reconsider the structure.
    // For now, let's keep it simple and assume we can pass data.
    // A better approach would be to use postMessage to update the iframe content.

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
                        <WebsitePageClient pageData={livePageData} />
                    </div>
                </div>
            </div>
        </div>
    );
}
