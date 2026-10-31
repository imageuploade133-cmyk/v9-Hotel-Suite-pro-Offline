
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { firestore as publicFirestore } from '@/firebase/server-init';
import { collection, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { firestoreCache, CacheTTL, CacheKeys } from '@/lib/firestore-cache';
import { useBranch } from './branch-context';

interface ShiftSettings {
    startTime: string;
    lateGracePeriod: number;
}

const DEFAULT_SETTINGS = {
    currency: 'USD',
    salaryPayday: 28,
    staffPerDayRate: 50,
    enableRestock: true,
    enableGuestReportSound: true,
    paymentMethods: [] as string[],
};

interface Settings {
    currency?: string;
    salaryPayday?: number;
    staffPerDayRate?: number;
    enableRestock?: boolean;
    enableGuestReportSound?: boolean;
    guestReportNotificationSoundUrl?: string;
    shiftSettings?: {
        morning: ShiftSettings;
        night: ShiftSettings;
        twentyFourHours?: {
            trackLateness: boolean;
            lateAfterTime?: string;
        };
        enableAutoDeduction?: boolean;
        lateDeductionAmount?: number;
        [key: string]: any;
    };
    paymentMethods?: string[];
    [key: string]: any;
}

interface SettingsContextValue {
  settings: Settings;
  isLoading: boolean;
  refreshSettings: () => void;
  // Separate POS settings for Global vs Branch contexts
  globalPosSettings: Partial<Settings> | null;
  branchPosSettings: Partial<Settings> | null;
  // Helper to get effective POS settings based on current context
  getEffectivePosSettings: () => Partial<Settings>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  refreshSettings: () => {},
  globalPosSettings: null,
  branchPosSettings: null,
  getEffectivePosSettings: () => ({}),
});

export const useSettings = () => useContext(SettingsContext);

const getInitialSettings = (): Settings => {
  if (typeof window !== 'undefined') {
    // 1. Check firestoreCache
    const cached = firestoreCache.get<Settings>(CacheKeys.settings());
    if (cached && Object.keys(cached).length > 0) return { ...DEFAULT_SETTINGS, ...cached };

    // 2. Check direct localStorage fallback for persistent offline configuration
    try {
      const raw = localStorage.getItem('app_saved_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_SETTINGS, ...parsed };
        }
      }
    } catch {}
  }
  return DEFAULT_SETTINGS;
};

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(getInitialSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [globalPosSettings, setGlobalPosSettings] = useState<Partial<Settings> | null>(null);
  const [branchPosSettings, setBranchPosSettings] = useState<Partial<Settings> | null>(null);
  const firestore = useFirestore();
  const pathname = usePathname();
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const { currentBranchId, getCollectionPath, isBranchMode, isGlobalMode } = useBranch();
  const isPublicPage = pathname.startsWith('/menus') || pathname.startsWith('/guest-bill') || pathname.startsWith('/guest-report');

  const fetchSettings = useCallback(async () => {
    const db = isPublicPage ? publicFirestore : firestore;
    if (!db || isFetchingRef.current) return;

    isFetchingRef.current = true;

    const fetchWithTimeout = async <T,>(p: Promise<T>, ms = 1500): Promise<T | null> => {
      try {
        return await Promise.race([
          p,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
        ]);
      } catch {
        return null;
      }
    };

    try {
        // Multi-tier fallback strategy for settings:
        // Priority 1: Keep current settings as baseline (never drop currency/configuration)
        const mergedSettings: Settings = { ...DEFAULT_SETTINGS, ...settings };

        // Priority 2: Query Local Master LAN Store (/api/lan-sync?collection=settings)
        try {
          const lanRes = await fetchWithTimeout(fetch(`/api/lan-sync?collection=settings`), 1000);
          if (lanRes && lanRes.ok) {
            const lanResult = await lanRes.json();
            if (lanResult.data) {
              const settingsDocs = Object.values(lanResult.data);
              settingsDocs.forEach((docData: any) => {
                if (docData && typeof docData === 'object') {
                  Object.assign(mergedSettings, docData);
                }
              });
            }
          }
        } catch (lanErr) {
          console.warn('[Settings Context] LAN settings query error:', lanErr);
        }

        // Priority 3: Fetch directly from 'settings/global' document in Firestore
        try {
          const globalDocRef = doc(db, 'settings', 'global');
          const globalDocSnap = await fetchWithTimeout(getDoc(globalDocRef), 1200);
          if (globalDocSnap && globalDocSnap.exists()) {
            Object.assign(mergedSettings, globalDocSnap.data());
          }
        } catch {}

        // Priority 4: Fetch all documents in 'settings' collection
        try {
          const settingsCollectionRef = collection(db, 'settings');
          const settingsSnapshot = await fetchWithTimeout(getDocs(settingsCollectionRef), 1200);
          if (settingsSnapshot && settingsSnapshot.forEach) {
            settingsSnapshot.forEach((doc) => {
                Object.assign(mergedSettings, doc.data());
            });
          }
        } catch {}

        // Store global POS settings separately (for reference when in branch mode)
        const extractedGlobalPosSettings: Partial<Settings> = {};
        const posSettingFields = [
            'businessName', 'businessAddress', 'businessPhone', 'businessEmail',
            'posReceiptLogoUrl', 'posReceiptLogoSize', 'posUseBusinessLogo',
            'posReceiptHeader', 'posReceiptFooter', 'posReceiptTitle',
            'posShowBusinessName', 'posShowAddress', 'posShowPhone', 'posShowEmail',
            'posShowDate', 'posShowCashierName', 'posShowPaymentMethod', 'posShowBarcode',
            'posShowCategorySeparator', 'posEnableTax', 'posTaxLabel', 'posTaxRate',
            'posTaxNumber', 'posAutoPrint', 'posAutoPrintTableUpdates',
            'posAutoGenerateReceiptOnRunningTable', 'posPrintCopies', 'posPaperWidth',
            'posThankYouMessage', 'posRefundPolicy', 'posTermsAndConditions',
            'posAllowPopups',
            ];
        posSettingFields.forEach(field => {
            if (mergedSettings[field] !== undefined) {
                extractedGlobalPosSettings[field] = mergedSettings[field];
            }
        });

        // 2. Fetch branch-specific POS settings if in branch mode
        let extractedBranchPosSettings: Partial<Settings> | null = null;
        if (currentBranchId && currentBranchId !== 'global') {
            try {
                const branchSettingsPath = `branches/${currentBranchId}/posSettings`;
                const branchSettingsCollectionRef = collection(db, branchSettingsPath);
                const branchSettingsSnapshot = await getDocs(branchSettingsCollectionRef);
                extractedBranchPosSettings = {};
                branchSettingsSnapshot.forEach((doc) => {
                    Object.assign(extractedBranchPosSettings!, doc.data());
                });
            } catch (err) {
                console.error("Failed to fetch branch settings:", err);
            }
        }

        const paymentMethodsCollectionRef = collection(db, 'paymentMethods');
        const paymentMethodsSnapshot = await getDocs(paymentMethodsCollectionRef);
        const paymentMethods = paymentMethodsSnapshot.docs.map(doc => doc.data().name as string);
        mergedSettings.paymentMethods = paymentMethods;

        firestoreCache.set(CacheKeys.settings(), mergedSettings, CacheTTL.HOUR);
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('app_saved_settings', JSON.stringify(mergedSettings));
          }
        } catch {}

        if (mountedRef.current) {
            setSettings(mergedSettings);
            setGlobalPosSettings(extractedGlobalPosSettings);
            setBranchPosSettings(extractedBranchPosSettings);
        }
    } catch (error) {
        console.error("Failed to fetch settings:", error);
    } finally {
        if (mountedRef.current) {
            setIsLoading(false);
        }
        isFetchingRef.current = false;
    }
  }, [firestore, isPublicPage, currentBranchId, getCollectionPath]);

  useEffect(() => {
    mountedRef.current = true;

    const db = isPublicPage ? publicFirestore : firestore;
    if (!db) return;

    const cachedSettings = firestoreCache.get<Settings>(CacheKeys.settings());
    if (!cachedSettings) {
      fetchSettings();
    }

    let skipFirstSettings = true;
    const unsubscribeSettings = onSnapshot(collection(db, 'settings'), () => {
      if (skipFirstSettings) { skipFirstSettings = false; return; }
      fetchSettings();
    }, () => {});

    let unsubscribeBranchSettings: () => void = () => {};
    if (currentBranchId && currentBranchId !== 'global') {
        const branchSettingsPath = `branches/${currentBranchId}/posSettings`;
        unsubscribeBranchSettings = onSnapshot(collection(db, branchSettingsPath), () => {
            fetchSettings();
        }, () => {});
    }

    let skipFirstPM = true;
    const unsubscribePaymentMethods = onSnapshot(collection(db, 'paymentMethods'), () => {
      if (skipFirstPM) { skipFirstPM = false; return; }
      fetchSettings();
    }, () => {});

    return () => {
      mountedRef.current = false;
      unsubscribeSettings();
      unsubscribeBranchSettings();
      unsubscribePaymentMethods();
    };
  }, [firestore, isPublicPage, currentBranchId, fetchSettings]);

  const refreshSettings = useCallback(() => {
    isFetchingRef.current = false;
    fetchSettings();
  }, [fetchSettings]);

  // Get effective POS settings based on current context (Global vs Branch)
  const getEffectivePosSettings = useCallback((): Partial<Settings> => {
    if (isGlobalMode || !currentBranchId || currentBranchId === 'global') {
      // In Global mode: use global POS settings
      return globalPosSettings || {};
    }
    // In Branch mode: use branch-specific POS settings (no fallback to global)
    return branchPosSettings || {};
  }, [isGlobalMode, currentBranchId, globalPosSettings, branchPosSettings]);

  const contextValue = useMemo(
    () => ({
      settings,
      isLoading,
      refreshSettings,
      globalPosSettings,
      branchPosSettings,
      getEffectivePosSettings,
    }),
    [settings, isLoading, refreshSettings, globalPosSettings, branchPosSettings, getEffectivePosSettings]
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};
