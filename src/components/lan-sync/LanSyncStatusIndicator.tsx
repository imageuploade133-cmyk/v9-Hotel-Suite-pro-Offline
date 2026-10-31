'use client';

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Cloud, CloudUpload, RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function LanSyncStatusIndicator() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const checkSyncStatus = async () => {
    try {
      const res = await fetch('/api/lan-sync');
      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          setPendingCount(data.summary.pendingMutationsCount || 0);
          setLastSyncTime(data.summary.lastCloudSync || null);
        }
      }
    } catch {
      // Offline LAN or server unreachable
    }
  };

  const triggerCloudSync = async () => {
    setIsSyncing(true);
    try {
      await fetch('/api/lan-sync/cloud-sync', { method: 'POST' });
      await checkSyncStatus();
    } catch {
      // Failed sync
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-9 w-9 rounded-full border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
          aria-label="Network & Cloud Sync Status"
          title="Network & Cloud Sync Status"
        >
          {isSyncing ? (
            <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
          ) : isOnline ? (
            <Wifi className="h-4 w-4 text-emerald-400" />
          ) : (
            <WifiOff className="h-4 w-4 text-amber-400" />
          )}

          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 p-2">
        <DropdownMenuLabel className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
          Sync Status
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="flex items-center justify-between py-1.5 px-2 text-sm">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-emerald-500" />
            <span>Local Network (LAN)</span>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500">
            Active
          </span>
        </div>

        <div className="flex items-center justify-between py-1.5 px-2 text-sm">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Cloud className="h-4 w-4 text-blue-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-amber-500" />
            )}
            <span>Cloud Sync</span>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              isOnline
                ? 'bg-blue-500/10 text-blue-500'
                : 'bg-amber-500/10 text-amber-500'
            }`}
          >
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {lastSyncTime && (
          <div className="px-2 py-1 text-xs text-muted-foreground">
            Last synced: {new Date(lastSyncTime).toLocaleTimeString()}
          </div>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={isSyncing || !isOnline}
          onClick={triggerCloudSync}
          className="flex items-center justify-center gap-2 text-xs font-medium cursor-pointer"
        >
          {isSyncing ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Syncing...</span>
            </>
          ) : (
            <>
              <CloudUpload className="h-3.5 w-3.5" />
              <span>
                {pendingCount > 0 ? `Sync ${pendingCount} Changes` : 'Sync to Cloud'}
              </span>
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
