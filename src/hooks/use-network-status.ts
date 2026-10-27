'use client';

import { useState, useEffect } from 'react';

// Extend the Navigator interface to include the Network Information API properties
declare global {
  interface Navigator {
    connection?: {
      effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
      downlink: number;
      rtt: number;
      saveData: boolean;
      addEventListener: (type: 'change', listener: EventListener) => void;
      removeEventListener: (type: 'change', listener: EventListener) => void;
    };
  }
}

export const useNetworkStatus = () => {
  const [networkStatus, setNetworkStatus] = useState({
    effectiveType: '4g',
  });

  useEffect(() => {
    const connection = navigator.connection;
    if (!connection) {
      return;
    }

    const updateStatus = () => {
      setNetworkStatus({
        effectiveType: connection.effectiveType,
      });
    };

    updateStatus(); // Initial status

    connection.addEventListener('change', updateStatus);

    return () => {
      connection.removeEventListener('change', updateStatus);
    };
  }, []);

  return networkStatus;
};
