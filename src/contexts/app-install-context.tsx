
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface AppInstallContextType {
  installPrompt: BeforeInstallPromptEvent | null;
  canInstall: boolean;
  isStandalone: boolean;
  triggerInstall: () => void;
  showInstallModal: boolean;
  openInstallModal: () => void;
  closeInstallModal: () => void;
  permanentlyHideInstallModal: () => void;
}

const AppInstallContext = createContext<AppInstallContextType | undefined>(undefined);

export const useAppInstall = () => {
  const context = useContext(AppInstallContext);
  if (!context) {
    throw new Error('useAppInstall must be used within an AppInstallProvider');
  }
  return context;
};

const HIDE_INSTALL_MODAL_KEY = 'hideInstallAppModal';

export const AppInstallProvider = ({ children }: { children: ReactNode }) => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }

    let disposed = false;
    let activeRegistration: ServiceWorkerRegistration | null = null;

    const updateServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) return;
      try {
        // Bypass the HTTP cache for the worker script itself. This makes the
        // browser discover a deployed worker update instead of reusing stale SW.
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        if (disposed) return;
        activeRegistration = registration;
        if (navigator.onLine) {
          await registration.update().catch((error) => {
            console.warn('Service Worker update check failed:', error);
          });
        }
      } catch (error) {
        // Service worker support is optional; the app must remain usable even
        // when registration is blocked by browser policy or private mode.
        console.warn('Service Worker registration failed:', error);
      }
    };

    const handleOnline = () => {
      void updateServiceWorker();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void activeRegistration?.update().catch((error) => {
          console.warn('Service Worker update check failed:', error);
        });
      }
    };

    void updateServiceWorker();
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const canInstall = !!installPrompt && !isStandalone;

  useEffect(() => {
    if (canInstall) {
      try {
        if (!localStorage.getItem(HIDE_INSTALL_MODAL_KEY)) {
          setShowInstallModal(true);
        }
      } catch {
        // Storage can be unavailable in restricted browser contexts.
      }
    }
  }, [canInstall]);

  const triggerInstall = () => {
    if (!installPrompt) return;
    void installPrompt.prompt();
    void installPrompt.userChoice.then(() => {
      setInstallPrompt(null);
      setShowInstallModal(false);
    }).catch((error) => {
      console.warn('Install prompt did not complete:', error);
    });
  };

  const openInstallModal = () => {
    if (canInstall) setShowInstallModal(true);
  };

  const closeInstallModal = () => setShowInstallModal(false);

  const permanentlyHideInstallModal = () => {
    try {
      localStorage.setItem(HIDE_INSTALL_MODAL_KEY, 'true');
    } catch {
      // Hiding for this session still works if persistent storage is blocked.
    }
    setShowInstallModal(false);
  };

  const value = useMemo(() => ({
    installPrompt,
    canInstall,
    isStandalone,
    triggerInstall,
    showInstallModal,
    openInstallModal,
    closeInstallModal,
    permanentlyHideInstallModal,
  }), [installPrompt, canInstall, isStandalone, triggerInstall, showInstallModal, openInstallModal, closeInstallModal, permanentlyHideInstallModal]);

  return <AppInstallContext.Provider value={value}>{children}</AppInstallContext.Provider>;
};
