
'use client';

import * as React from 'react';

declare global {
  interface Navigator {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  }
}

interface AppBadgeUpdaterProps {
    count: number;
}

export const AppBadgeUpdater = ({ count }: AppBadgeUpdaterProps) => {

    React.useEffect(() => {
        if ('setAppBadge' in navigator) {
            try {
                if (count > 0) {
                    navigator.setAppBadge(count);
                } else {
                    navigator.clearAppBadge?.();
                }
            } catch (error) {
                console.error("Failed to set app badge:", error);
            }
        }
    }, [count]);

    return null; // This component does not render anything
}
