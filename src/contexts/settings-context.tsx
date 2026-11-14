
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { firestore as publicFirestore } from '@/firebase/server-init';
import { collection, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { firestoreCache, CacheTTL, CacheKeys } from '@/lib/firestore-cache';
import { useBranch } from './branch-context';
import { isLocalMasterHost } from '@/lib/lan-sync/is-local-master-host';

interface ShiftSettings {
    startTime: string;
    lateGracePeriod: number;
}

const DEFAULT_SETTINGS = {
    salaryPayday: 28,
    staffPerDayRate: 50,
    enableRestock: true,
    enableGuestReportSound: true,
    requireGuestBillsPaidBeforeRenewal: false,
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
  getEffectivePosSettings: (context?: 'hotel' | 'pos') => Partial<Settings>;
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
    // 1. Check direct localStorage fallback first for persistent instant retrieval
    try {
      const raw = localStorage.getItem('app_saved_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_SETTINGS, ...parsed };
        }
      }
    } catch {}

    // 2. Check firestoreCache
    const cached = firestoreCache.get<Settings>(CacheKeys.settings());
    if (cached && Object.keys(cached).length > 0) return { ...DEFAULT_SETTINGS, ...cached };
  }
  return DEFAULT_SETTINGS;
};

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(getInitialSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  // Settings are a startup dependency: protected workspaces stay hidden until a
  // verified persisted or remote settings source has been resolved.
  const [isLoading, setIsLoading] = useState(true);
  const [globalPosSettings, setGlobalPosSettings] = useState<Partial<Settings> | null>(null);
  const [branchPosSettings, setBranchPosSettings] = useState<Partial<Settings> | null>(null);
  const firestore = useFirestore();
  const pathname = usePathname();
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const hasResolvedSettingsRef = useRef(!!(
    settings.currency || settings.businessName || settings.businessAddress ||
    (Array.isArray(settings.paymentMethods) && settings.paymentMethods.length > 0)
  ));

  const { currentBranchId, getCollectionPath, isBranchMode, isGlobalMode } = useBranch();
  const isPublicPage = pathname.startsWith('/menus') || pathname.startsWith('/guest-bill') || pathname.startsWith('/guest-report');

  const fetchSettings = useCallback(async () => {
    const db = isPublicPage ? publicFirestore : firestore;
    if (!db || isFetchingRef.current) return;

    isFetchingRef.current = true;
    if (mountedRef.current && !hasResolvedSettingsRef.current) setIsLoading(true);

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
        const mergedSettings: Settings = { ...DEFAULT_SETTINGS, ...settingsRef.current };

        // Priority 2: Query Local Master LAN Store (/api/lan-sync?collection=settings)
        if (isLocalMasterHost()) try {
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

        // POS configuration is stored separately from general application settings.
        // Read it from the Local Master cache as well so the POS defaults remain available offline.
        if (isLocalMasterHost()) try {
          const posRes = await fetchWithTimeout(fetch('/api/lan-sync?collection=posSettings'), 1000);
          if (posRes && posRes.ok) {
            const posResult = await posRes.json();
            if (posResult.data) {
              Object.values(posResult.data).forEach((docData: any) => {
                if (docData && typeof docData === 'object') Object.assign(mergedSettings, docData);
              });
            }
          }
        } catch (posLanErr) {
          console.warn('[Settings Context] LAN POS settings query error:', posLanErr);
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

        // Load the dedicated root POS settings document. POSSettingsForm persists
        // global configuration in posSettings/settings rather than settings/global.
        try {
          const globalPosSnapshot = await fetchWithTimeout(getDoc(doc(db, 'posSettings', 'settings')), 1200);
          if (globalPosSnapshot?.exists()) {
            Object.assign(mergedSettings, globalPosSnapshot.data());
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
            'posPrintBoldText', 'posPrintBoldLines',
            'bankName', 'accountName', 'accountNumber', 'bankLogoUrl',
            'showAccountOnDocket', 'showAccountOnPaid',
            'posThankYouMessage', 'posRefundPolicy', 'posTermsAndConditions',
            'posAllowPopups', 'posApplyToAll',
            // Dedicated Hotel Booking POS settings
            'hotelPosUseCustomLogo', 'hotelPosReceiptLogoUrl', 'hotelPosReceiptLogoSize',
            'hotelPosReceiptHeader', 'hotelPosReceiptFooter', 'hotelPosBusinessName',
            'hotelPosBusinessAddress', 'hotelPosBusinessPhone',
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
                const branchSettingsSnapshot = await fetchWithTimeout(getDocs(branchSettingsCollectionRef), 1200);
                extractedBranchPosSettings = {};
                branchSettingsSnapshot?.forEach((doc) => {
                    Object.assign(extractedBranchPosSettings!, doc.data());
                });
            } catch (err) {
                console.error("Failed to fetch branch settings:", err);
            }
        }

        const paymentMethodsCollectionRef = collection(db, 'paymentMethods');
        const paymentMethodsSnapshot = await fetchWithTimeout(getDocs(paymentMethodsCollectionRef), 1200);
        if (paymentMethodsSnapshot) {
          mergedSettings.paymentMethods = paymentMethodsSnapshot.docs
            .map(doc => doc.data().name as string)
            .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
        }

        firestoreCache.set(CacheKeys.settings(), mergedSettings, CacheTTL.HOUR);
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('app_saved_settings', JSON.stringify(mergedSettings));
          }
        } catch {}

        if (mountedRef.current) {
            hasResolvedSettingsRef.current = true;
            setSettings(mergedSettings);
            setGlobalPosSettings(extractedGlobalPosSettings);
            setBranchPosSettings(extractedBranchPosSettings);
        }
    } catch (error) {
        console.error("Failed to fetch settings:", error);
    } finally {
        if (mountedRef.current) {
            hasResolvedSettingsRef.current = true;
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
    let persistedSettings: Settings | null = null;
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('app_saved_settings') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          persistedSettings = parsed as Settings;
        }
      }
    } catch {}

    // A previously saved business configuration is safe to use immediately,
    // including offline. Still revalidate it whenever the cloud/LAN is reachable.
    const availableCachedSettings = cachedSettings || persistedSettings;
    if (availableCachedSettings && Object.keys(availableCachedSettings).length > 0) {
      hasResolvedSettingsRef.current = true;
      setSettings(previous => ({ ...DEFAULT_SETTINGS, ...previous, ...availableCachedSettings }));
      setIsLoading(false);
    }

    const canRefreshFromSource = typeof navigator === 'undefined'
      || navigator.onLine
      || isLocalMasterHost();
    if (!availableCachedSettings || canRefreshFromSource) {
      void fetchSettings();
    } else {
      setIsLoading(false);
    }

    let skipFirstSettings = true;
    const unsubscribeSettings = onSnapshot(collection(db, 'settings'), () => {
      if (skipFirstSettings) { skipFirstSettings = false; return; }
      fetchSettings();
    }, () => {});

    let skipFirstGlobalPosSettings = true;
    const unsubscribeGlobalPosSettings = onSnapshot(doc(db, 'posSettings', 'settings'), () => {
      if (skipFirstGlobalPosSettings) { skipFirstGlobalPosSettings = false; return; }
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
      unsubscribeGlobalPosSettings();
      unsubscribeBranchSettings();
      unsubscribePaymentMethods();
    };
  }, [firestore, isPublicPage, currentBranchId, fetchSettings]);

  const refreshSettings = useCallback(() => {
    isFetchingRef.current = false;
    fetchSettings();
  }, [fetchSettings]);

  // Get effective POS settings based on current context (Global vs Branch vs Hotel POS)
  const getEffectivePosSettings = useCallback((context?: 'hotel' | 'pos'): Partial<Settings> => {
    // Determine base settings
    const isGlobal = isGlobalMode || !currentBranchId || currentBranchId === 'global';
    const applyToAll = !!(globalPosSettings?.posApplyToAll || settings?.posApplyToAll);

    // If posApplyToAll is enabled, global settings universally govern all POS receipts
    let base = (isGlobal || applyToAll)
      ? (globalPosSettings || {})
      : (branchPosSettings || globalPosSettings || {});

    // If this is specifically Hotel Booking POS context and dedicated hotel POS settings exist
    if (context === 'hotel') {
      const hotelCustom = { ...base };
      if (base.hotelPosUseCustomLogo) {
        if (base.hotelPosReceiptLogoUrl !== undefined) {
          hotelCustom.posReceiptLogoUrl = base.hotelPosReceiptLogoUrl;
          hotelCustom.posUseBusinessLogo = false;
        }
        if (base.hotelPosReceiptLogoSize !== undefined) {
          hotelCustom.posReceiptLogoSize = base.hotelPosReceiptLogoSize;
        }
      }
      if (base.hotelPosReceiptHeader) {
        hotelCustom.posReceiptHeader = base.hotelPosReceiptHeader;
      }
      if (base.hotelPosReceiptFooter) {
        hotelCustom.posReceiptFooter = base.hotelPosReceiptFooter;
      }
      if (base.hotelPosBusinessName) {
        hotelCustom.businessName = base.hotelPosBusinessName;
      }
      if (base.hotelPosBusinessAddress) {
        hotelCustom.businessAddress = base.hotelPosBusinessAddress;
      }
      if (base.hotelPosBusinessPhone) {
        hotelCustom.businessPhone = base.hotelPosBusinessPhone;
      }
      return hotelCustom;
    }

    return base;
  }, [isGlobalMode, currentBranchId, globalPosSettings, branchPosSettings, settings]);

  // Publish effective POS print appearance for every print surface in the project.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const appearance = getEffectivePosSettings('pos');
    document.documentElement.dataset.posPrintBoldText = appearance.posPrintBoldText ? 'true' : 'false';
    document.documentElement.dataset.posPrintBoldLines = appearance.posPrintBoldLines ? 'true' : 'false';
  }, [getEffectivePosSettings]);

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
