'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Wifi, WifiOff, Cloud, CloudUpload, RefreshCw, Radio } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { isLocalMasterHost } from '@/lib/lan-sync/is-local-master-host';
import { lanSseClient } from '@/lib/lan-sync/sse-client';

export function LanSyncStatusIndicator() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [sseStatus, setSseStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const isSyncingRef = useRef(false);

  const checkSyncStatus = async () => {
    if (!isLocalMasterHost()) return;
    try {
      const res = await fetch('/api/lan-sync');
      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          const pending = data.summary.pendingMutationsCount || 0;
          setPendingCount(pending);
          setLastSyncTime(data.summary.lastCloudSync || null);

          // If online and mutations are pending, automatically trigger background sync
          if (navigator.onLine && pending > 0 && !isSyncingRef.current) {
            triggerCloudSync();
          }
        }
      }
    } catch {
      // Offline LAN or server unreachable
    }
  };

  const triggerCloudSync = async () => {
    if (!isLocalMasterHost() || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      await fetch('/api/lan-sync/cloud-sync', { method: 'POST' });
      await checkSyncStatus();
    } catch {
      // Failed sync
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    setIsOnline(navigator.onLine);

    // Listen to local SSE real-time connection status
    const unsubSse = lanSseClient.onStatusChange((status) => {
      setSseStatus(status);
    });

    const handleOnline = () => {
      setIsOnline(true);
      // Automatically synchronize all offline data to Cloud Firebase when internet returns
      triggerCloudSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 8000);

    return () => {
      unsubSse();
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
          size="sm"
          className="relative h-9 gap-1.5 px-2.5 text-xs font-medium border border-border bg-card hover:bg-muted text-foreground"
          aria-label="Network & Cloud Sync Status"
          title="Network & Cloud Sync Status"
        >
          {isSyncing ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-500" />
          ) : sseStatus === 'connected' ? (
            <Radio className="h-3.5 w-3.5 text-emerald-500" />
          ) : isOnline ? (
            <Wifi className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-amber-500" />
          )}

          <span className="hidden sm:inline">
            {isSyncing ? 'Syncing...' : sseStatus === 'connected' ? 'LAN Live' : isOnline ? 'Online' : 'Offline'}
          </span>

          {pendingCount > 0 && (
            <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-2 text-xs">
        <DropdownMenuLabel className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
          Offline & Cloud Sync Status
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="flex items-center justify-between py-1.5 px-2">
          <div className="flex items-center gap-2">
            <Radio className={`h-4 w-4 ${sseStatus === 'connected' ? 'text-emerald-500' : 'text-amber-500'}`} />
            <span>Local Real-Time (SSE)</span>
          </div>
          <span className={`font-medium ${sseStatus === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {sseStatus === 'connected' ? 'Connected (0ms)' : 'Reconnecting'}
          </span>
        </div>

        <div className="flex items-center justify-between py-1.5 px-2">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Cloud className="h-4 w-4 text-blue-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-amber-500" />
            )}
            <span>Internet Connectivity</span>
          </div>
          <span
            className={`font-medium ${
              isOnline ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {isOnline ? 'Online' : 'Offline Mode'}
          </span>
        </div>

        <div className="flex items-center justify-between py-1.5 px-2">
          <div className="flex items-center gap-2">
            <CloudUpload className="h-4 w-4 text-muted-foreground" />
            <span>Cloud Sync Queue</span>
          </div>
          <span className="font-semibold">
            {pendingCount === 0 ? 'All Synced' : `${pendingCount} pending`}
          </span>
        </div>

        {lastSyncTime && (
          <div className="px-2 py-1 text-[11px] text-muted-foreground border-t border-border mt-1 pt-1">
            Last cloud sync: {new Date(lastSyncTime).toLocaleTimeString()}
          </div>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={triggerCloudSync}
          disabled={isSyncing || !isOnline}
          className="cursor-pointer font-medium text-xs flex items-center justify-center gap-2 py-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing to Cloud...' : 'Sync Now to Cloud'}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="cursor-pointer font-medium text-xs flex items-center justify-center py-2 text-primary">
          <Link href="/cloud-sync" className="w-full text-center">
            Open Cloud Sync Center →
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
