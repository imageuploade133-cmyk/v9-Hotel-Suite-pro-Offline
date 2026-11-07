'use client';

import * as React from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FullscreenLoaderProps {
  message?: string;
  subtext?: string;
  className?: string;
  /** Keep very short loading states from flashing a full-screen loader. */
  delayMs?: number;
}

export function FullscreenLoader({
  message = 'Please wait...',
  subtext,
  className,
  delayMs = 150,
}: FullscreenLoaderProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const appName = 'v9 Hotel Suite Pro';

  React.useEffect(() => {
    if (delayMs <= 0) {
      setIsVisible(true);
      return;
    }

    const timeoutId = window.setTimeout(() => setIsVisible(true), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs]);

  // Avoid mounting and unmounting the overlay for quick state transitions.
  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[1000] flex flex-col items-center justify-center',
        'select-none bg-background',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center justify-center gap-3 p-5 text-center">
        <div className="flex items-center justify-center rounded-xl bg-primary/5 p-2 text-primary motion-reduce:animate-none animate-[hotel-loader-bounce_2.4s_ease-in-out_infinite]">
          <Building2 className="h-7 w-7 stroke-[1.8] sm:h-8 sm:w-8" aria-hidden="true" />
        </div>

        <div className="flex max-w-xs flex-col items-center gap-1">
          <h3 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            {appName}
          </h3>
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">
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
