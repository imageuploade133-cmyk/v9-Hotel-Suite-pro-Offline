'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

const ConnectivityContext = createContext<boolean>(true);

export const useConnectivity = () => useContext(ConnectivityContext);

export const ConnectivityProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline',handleOffline);
    };
  }, []);

  return (
    <ConnectivityContext.Provider value={isOnline}>
      {children}
    </ConnectivityContext.Provider>
  );
};
