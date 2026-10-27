'use client';

import * as React from 'react';
import { Wifi, WifiLow, WifiOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useConnectivity } from '@/contexts/connectivity-context';

export function NetworkStatusIndicator() {
  const { effectiveType } = useNetworkStatus();
  const isOnline = useConnectivity();

  const getNetworkInfo = () => {
    if (!isOnline) {
      return { Icon: WifiOff, label: 'Offline', color: 'text-destructive' };
    }
    switch (effectiveType) {
      case '4g':
        return { Icon: Wifi, label: 'Fast Connection', color: 'text-success' };
      case '3g':
        return { Icon: Wifi, label: 'Good Connection', color: 'text-yellow-500' };
      case '2g':
      case 'slow-2g':
        return { Icon: WifiLow, label: 'Slow Connection', color: 'text-orange-500' };
      default:
        return { Icon: Wifi, label: 'Connected', color: 'text-muted-foreground' };
    }
  };

  const { Icon, label, color } = getNetworkInfo();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center justify-center h-10 w-10">
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
