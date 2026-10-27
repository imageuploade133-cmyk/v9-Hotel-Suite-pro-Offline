'use client';

import { WifiOff } from 'lucide-react';
import { useConnectivity } from '@/contexts/connectivity-context';
import { cn } from '@/lib/utils';

export const OfflineIndicator = () => {
  const isOnline = useConnectivity();

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 z-50 flex items-center gap-3 rounded-lg bg-destructive p-3 text-destructive-foreground shadow-lg transition-all duration-300',
        isOnline ? 'translate-y-[200%] opacity-0' : 'translate-y-0 opacity-100'
      )}
    >
      <WifiOff className="h-5 w-5" />
      <div>
        <p className="font-bold">You are offline</p>
        <p className="text-sm">Some features may be unavailable.</p>
      </div>
    </div>
  );
};
