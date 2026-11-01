'use client';

import * as React from 'react';
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
  const appName = 'v9 Hotel Suite Pro';

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center',
        'bg-background/60 backdrop-blur-md select-none transition-all duration-300',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center justify-center gap-4 text-center p-6">
        {/* Slow Bouncing Transparent Project App Logo */}
        <div className="relative flex items-center justify-center animate-[bounce_2s_infinite]">
          {/* Transparent container with glow effect */}
          <div className="relative flex items-center justify-center p-3 rounded-2xl bg-transparent">
            {/* Project App Logo SVG - Transparent with primary theme color */}
            <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center text-primary drop-shadow-[0_10px_20px_rgba(var(--primary),0.35)]">
              <Building2 className="h-full w-full stroke-[1.8]" />
            </div>
          </div>
        </div>

        {/* Project App Name & Please Wait message */}
        <div className="flex flex-col items-center gap-1.5 max-w-xs sm:max-w-sm">
          <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            {appName}
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
