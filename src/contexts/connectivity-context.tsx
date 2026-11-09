'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ConnectivityContext = createContext<boolean>(true);

export const useConnectivity = () => useContext(ConnectivityContext);

export const ConnectivityProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const verifyReachability = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.onLine) {
      setIsOnline(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1400);
    try {
      // Any HTTP response means this app's host is reachable. A 503 from the
      // LAN-only endpoint on a cloud deployment is expected and still means
      // the browser is online; only a network failure/timeout means offline.
      await fetch('/api/lan-sync', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'x-connectivity-check': '1' },
      });
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      void verifyReachability();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // navigator.onLine can remain true when Wi-Fi is connected but the
    // application host cannot be reached. Verify occasionally without
    // blocking normal app operations.
    void verifyReachability();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void verifyReachability();
    }, 20000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(intervalId);
    };
  }, [verifyReachability]);

  return (
    <ConnectivityContext.Provider value={isOnline}>
      {children}
    </ConnectivityContext.Provider>
  );
};
