
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';

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
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
        setIsStandalone(true);
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => console.log('Service Worker registered with scope:', registration.scope))
            .catch((error) => console.error('Service Worker registration failed:', error));
    }


    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const canInstall = !!installPrompt && !isStandalone;

  useEffect(() => {
    if (canInstall) {
      const hideModal = localStorage.getItem(HIDE_INSTALL_MODAL_KEY);
      if (!hideModal) {
        setShowInstallModal(true);
      }
    }
  }, [canInstall]);

  const triggerInstall = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then(choiceResult => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        } else {
          console.log('User dismissed the install prompt');
        }
        setInstallPrompt(null);
        setShowInstallModal(false);
      });
    }
  };

  const openInstallModal = () => {
      if (canInstall) {
          setShowInstallModal(true);
      }
  }

  const closeInstallModal = () => {
    setShowInstallModal(false);
  };

  const permanentlyHideInstallModal = () => {
      localStorage.setItem(HIDE_INSTALL_MODAL_KEY, 'true');
      setShowInstallModal(false);
  }

  const value = useMemo(
    () => ({
      installPrompt,
      canInstall,
      isStandalone,
      triggerInstall,
      showInstallModal,
      openInstallModal,
      closeInstallModal,
      permanentlyHideInstallModal,
    }),
    [
      installPrompt,
      canInstall,
      isStandalone,
      triggerInstall,
      showInstallModal,
      openInstallModal,
      closeInstallModal,
      permanentlyHideInstallModal,
    ]
  );

  return (
    <AppInstallContext.Provider value={value}>
      {children}
    </AppInstallContext.Provider>
  );
};
