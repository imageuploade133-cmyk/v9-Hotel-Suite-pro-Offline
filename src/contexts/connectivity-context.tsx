'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ConnectivityContext = createContext<boolean>(true);

export const useConnectivity = () => useContext(ConnectivityContext);

const CHECK_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 2500;
const CHECK_INTERVAL_MS = 30000;
const FAILED_CHECKS_BEFORE_OFFLINE = 2;

export const ConnectivityProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const failedChecksRef = useRef(0);
  const requestInFlightRef = useRef(false);
  const activeControllerRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const verifyReachability = useCallback(async () => {
    if (typeof navigator === 'undefined') return;

    // The browser's offline event is the strongest immediate signal.
    if (!navigator.onLine) {
      failedChecksRef.current = FAILED_CHECKS_BEFORE_OFFLINE;
      setIsOnline(false);
      return;
    }

    // Avoid overlapping checks on slow or congested connections.
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;

    const controller = new AbortController();
    activeControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    try {
      // Probe independent public connectivity-check hosts. This verifies actual
      // internet access (not merely access to a Local Master on the same Wi-Fi).
      // no-cors is intentional: an opaque response still proves the host was reached.
      const probes = [
        'https://www.gstatic.com/generate_204',
        'https://connectivitycheck.gstatic.com/generate_204',
        'https://www.google.com/generate_204',
      ];
      await Promise.any(probes.map((url) => fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
      })));

      if (!navigator.onLine) {
        failedChecksRef.current = FAILED_CHECKS_BEFORE_OFFLINE;
        setIsOnline(false);
        return;
      }

      failedChecksRef.current = 0;
      setIsOnline(true);
    } catch {
      if (!navigator.onLine) {
        failedChecksRef.current = FAILED_CHECKS_BEFORE_OFFLINE;
        setIsOnline(false);
      } else {
        failedChecksRef.current += 1;

        // A single timeout is not enough to declare the user offline. Slow
        // connections, brief packet loss, and server cold starts are common.
        if (failedChecksRef.current >= FAILED_CHECKS_BEFORE_OFFLINE) {
          setIsOnline(false);
        } else if (retryTimerRef.current === null) {
          retryTimerRef.current = window.setTimeout(() => {
            retryTimerRef.current = null;
            void verifyReachability();
          }, RETRY_DELAY_MS);
        }
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
      requestInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    failedChecksRef.current = navigator.onLine ? 0 : FAILED_CHECKS_BEFORE_OFFLINE;

    const handleOnline = () => {
      failedChecksRef.current = 0;
      setIsOnline(true);
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      void verifyReachability();
    };

    const handleOffline = () => {
      failedChecksRef.current = FAILED_CHECKS_BEFORE_OFFLINE;
      activeControllerRef.current?.abort();
      setIsOnline(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void verifyReachability();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    void verifyReachability();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void verifyReachability();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      activeControllerRef.current?.abort();
    };
  }, [verifyReachability]);

  return (
    <ConnectivityContext.Provider value={isOnline}>
      {children}
    </ConnectivityContext.Provider>
  );
};
