'use client';

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, CloudCheck, CloudUpload, RefreshCw } from 'lucide-react';

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
      // Sync failed or offline
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
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800 text-slate-100 border border-slate-700 shadow-sm">
      <span className="flex items-center gap-1.5" title="LAN Master Wi-Fi Connection">
        <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        <span className="text-emerald-300 font-semibold">LAN 100% Active</span>
      </span>

      <span className="text-slate-500">|</span>

      {isOnline ? (
        <span className="flex items-center gap-1.5 text-blue-300" title="WAN Cloud Firestore Connection">
          <CloudCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>Cloud Ready</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-amber-300" title="WAN Offline - Queueing locally">
          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          <span>Cloud Offline (Saving Locally)</span>
        </span>
      )}

      {pendingCount > 0 && (
        <>
          <span className="text-slate-500">|</span>
          <button
            onClick={triggerCloudSync}
            disabled={isSyncing || !isOnline}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
            title="Pending mutations queue to Cloud Firestore"
          >
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
            ) : (
              <CloudUpload className="w-3 h-3 text-amber-400" />
            )}
            <span>{pendingCount} Sync Queue</span>
          </button>
        </>
      )}
    </div>
  );
}
