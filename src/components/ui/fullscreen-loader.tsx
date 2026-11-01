'use client';

import * as React from 'react';
import Image from 'next/image';
import { useSettings } from '@/contexts/settings-context';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FullscreenLoaderProps {
  message?: string;
  subtext?: string;
  className?: string;
}

export function FullscreenLoader({
  message = 'Please wait...',
  subtext,
  className,
}: FullscreenLoaderProps) {
  const { settings } = useSettings();
  const logoUrl = settings?.businessLogoUrl;
  const businessName = settings?.businessName || 'v9 Hotel Suite Pro';

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center',
        'bg-background/70 backdrop-blur-md select-none transition-all duration-300',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center justify-center gap-4 text-center p-6">
        {/* Slow Bouncing Logo Container */}
        <div className="relative flex items-center justify-center p-3 rounded-2xl bg-background/50 border border-white/10 shadow-xl backdrop-blur-sm animate-[bounce_2s_infinite]">
          {logoUrl ? (
            <div className="relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-xl">
              <Image
                src={logoUrl}
                alt={businessName}
                fill
                sizes="80px"
                className="object-contain"
                priority
              />
            </div>
          ) : (
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-10 w-10 sm:h-12 sm:w-12" />
            </div>
          )}
        </div>

        {/* Business Name & Please Wait message */}
        <div className="flex flex-col items-center gap-1.5 max-w-xs sm:max-w-sm">
          <h3 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
            {businessName}
          </h3>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground animate-pulse">
            {message}
          </p>
          {subtext && (
            <p className="text-[11px] text-muted-foreground/80">
              {subtext}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default FullscreenLoader;
