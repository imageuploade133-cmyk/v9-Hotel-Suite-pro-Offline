'use client';

import { useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore, collection, onSnapshot, Query, DocumentData, CollectionReference, getDocs, getDoc, DocumentReference, queryEqual, Unsubscribe } from 'firebase/firestore';
import { FirebaseClientProvider } from './client-provider';
import { isLocalMasterHost } from '@/lib/lan-sync/is-local-master-host';

export const useFirebase = () => {
    const context = useContext(FirebaseClientProvider.Context);
    if (context === undefined) {
        throw new Error("useFirebase must be used within a FirebaseClientProvider");
    }
    return context;
};

export const useAuthContext = () => {
    const { auth } = useFirebase();
    if (!auth) throw new Error("Auth not initialized");
    return auth;
};

export const useFirestore = () => {
    const { firestore } = useFirebase();
    return firestore;
};

export interface UseCollectionOptions<T> {
    onData?: (data: T[]) => void;
    onError?: (error: Error) => void;
    realtime?: boolean;
    cache?: boolean;
    disabled?: boolean;
}

export interface UseDocOptions<T> {
    onData?: (data: T | null) => void;
    onError?: (error: Error) => void;
    realtime?: boolean;
    cache?: boolean;
    disabled?: boolean;
}

export interface UseCollectionResult<T> {
    data: T[] | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

export interface UseDocResult<T> {
    data: T | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}


function mergeCloudAndLanData<T>(cloud: T[], local: T[]): T[] {
  if (!local.length) return cloud;
  const merged = new Map<string, T>();
  cloud.forEach((item, index) => {
    const key = (item as any)?.id || `cloud-${index}`;
    merged.set(key, item);
  });
  // Master-PC documents win for matching IDs and are added when not yet in cloud.
  local.forEach((item, index) => {
    const key = (item as any)?.id || `local-${index}`;
    merged.set(key, { ...(merged.get(key) || {} as T), ...item });
  });
  return Array.from(merged.values());
}

async function fetchLanCollectionData<T>(pathStr: string): Promise<T[]> {
  if (!isLocalMasterHost()) return [];
  try {
    const res = await fetch(`/api/lan-sync/?collection=${encodeURIComponent(pathStr)}`);
    if (res.ok) {
      const result = await res.json();
      if (result.data) {
        const restoreLanValues = (value: any): any => {
          if (value === '__LAN_INFINITY__') return Infinity;
          if (value === '__LAN_NEG_INFINITY__') return -Infinity;
          if (value === '__LAN_NAN__') return NaN;
          if (Array.isArray(value)) return value.map(restoreLanValues);
          if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, restoreLanValues(child)]));
          return value;
        };
        return Object.entries(result.data).map(([id, val]: [string, any]) => ({
          id,
          ...(typeof val === 'object' ? restoreLanValues(val) : {}),
        })) as T[];
      }
    }
  } catch (err) {
    console.warn('[LAN Sync] Local store query fallback failed:', err);
  }
  return [];
}

export function useCollection<T>(
    q: Query | CollectionReference | null,
    options?: UseCollectionOptions<T>
): UseCollectionResult<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const mountedRef = useRef(true);
  const onDataRef = useRef<((data: T[]) => void) | undefined>(undefined);
  const onErrorRef = useRef<((error: Error) => void) | undefined>(undefined);

  const { realtime = true, onData: onDataCallback, onError: onErrorCallback, disabled = false } = options || {};

  // Keep the callback refs up to date without triggering re-renders
  onDataRef.current = onDataCallback;
  onErrorRef.current = onErrorCallback;

  // Get the query from the factory if it's passed as a factory, otherwise use it directly
  const memoizedQuery = useMemo(
    () => q,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q]
  );

  useEffect(() => {
    if (disabled || !memoizedQuery) {
      setData([]);
      setIsLoading(false);
      return;
    }

    mountedRef.current = true;
    setIsLoading(true);

    // Clean up any existing subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    const resolvedPath = (memoizedQuery as any).path ||
      (memoizedQuery as any)._query?.path?.canonicalString?.() ||
      'collections';
    const pathStr = resolvedPath;

    // If offline, short-circuit immediately to LAN store without waiting for network timeouts
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    // If not realtime, do a one-time fetch
    if (!realtime) {
      const fetchData = async () => {
        try {
          if (isOffline) {
            const lanResults = await fetchLanCollectionData<T>(pathStr);
            if (mountedRef.current) {
              setData(lanResults);
              onDataRef.current?.(lanResults);
              setError(null);
            }
            return;
          }

          const snapshot = await getDocs(memoizedQuery);
          const cloudResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
          const lanResults = await fetchLanCollectionData<T>(pathStr);
          const results = mergeCloudAndLanData(cloudResults, lanResults);

          if (mountedRef.current) {
            setData(results);
            onDataRef.current?.(results);
            setError(null);
          }
        } catch (err) {
          console.error("useCollection fetch error, attempting local LAN store:", err);
          const lanResults = await fetchLanCollectionData<T>(pathStr);
          if (mountedRef.current) {
            setData(lanResults);
            onDataRef.current?.(lanResults);
            setError(null);
          }
        } finally {
          if (mountedRef.current) {
            setIsLoading(false);
          }
        }
      };
      fetchData();
      return;
    }

    // Immediately fetch from Local Master Server LAN API (0 ms latency)
    fetchLanCollectionData<T>(pathStr).then(lanResults => {
      if (mountedRef.current && lanResults && lanResults.length > 0) {
        setData(lanResults);
        onDataRef.current?.(lanResults);
        setIsLoading(false);
      } else if (mountedRef.current && isOffline) {
        setIsLoading(false);
      }
    });

    // Subscribe to Master Server Server-Sent Events (SSE) for instant cross-device Wi-Fi updates
    let unsubscribeSse: (() => void) | null = null;
    try {
      const { lanSseClient } = require('@/lib/lan-sync/sse-client');
      const targetCol = pathStr.split('/').pop() || pathStr;

      unsubscribeSse = lanSseClient.subscribe((event: any) => {
        if (!mountedRef.current || !event.collectionName) return;
        const eventCol = event.collectionName.split('/').pop() || event.collectionName;

        if (eventCol === targetCol || eventCol === pathStr) {
          setData((prev) => {
            const currentList = prev ? [...prev] : [];
            const docId = event.docId;

            if (event.action === 'delete') {
              const filtered = currentList.filter((item: any) => item.id !== docId);
              onDataRef.current?.(filtered);
              return filtered;
            }

            const itemIndex = currentList.findIndex((item: any) => item.id === docId);
            const newItem = { id: docId, ...(event.data || {}) } as T;

            let updatedList: T[];
            if (itemIndex >= 0) {
              updatedList = [...currentList];
              updatedList[itemIndex] = { ...currentList[itemIndex], ...newItem };
            } else {
              updatedList = [newItem, ...currentList];
            }

            onDataRef.current?.(updatedList);
            return updatedList;
          });
        }
      });
    } catch (e) {
      // SSE subscription is optional
    }

    // Set up real-time subscription with Firebase (when internet/cloud is available)
    const unsubscribe = onSnapshot(memoizedQuery,
      async (snapshot) => {
        const cloudResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
        const lanResults = await fetchLanCollectionData<T>(pathStr);
        const results = mergeCloudAndLanData(cloudResults, lanResults);

        if (mountedRef.current) {
          setData(results);
          onDataRef.current?.(results);
          setIsLoading(false);
          setError(null);
        }
      },
      async (err) => {
        const lanResults = await fetchLanCollectionData<T>(pathStr);
        if (mountedRef.current) {
          setData(lanResults);
          onDataRef.current?.(lanResults);
          setIsLoading(false);
          setError(null);
        }
      }
    );

    unsubscribeRef.current = () => {
      unsubscribe();
      if (unsubscribeSse) unsubscribeSse();
    };

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoizedQuery, realtime, disabled]);

  const refetch = useCallback(async () => {
    if (!memoizedQuery) return;

    setIsLoading(true);
    try {
      const snapshot = await getDocs(memoizedQuery);
      const cloudResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      const pathStr = (memoizedQuery as any).path ||
        (memoizedQuery as any)._query?.path?.canonicalString?.() || 'collections';
      const lanResults = await fetchLanCollectionData<T>(pathStr);
      const results = mergeCloudAndLanData(cloudResults, lanResults);

      if (mountedRef.current) {
        setData(results);
        onDataRef.current?.(results);
        setError(null);
      }
    } catch (err) {
      console.error("useCollection refetch error, attempting Local Master fallback:", err);
      const pathStr = (memoizedQuery as any).path ||
        (memoizedQuery as any)._query?.path?.canonicalString?.() || 'collections';
      const lanResults = await fetchLanCollectionData<T>(pathStr);
      if (mountedRef.current) {
        if (lanResults.length > 0) {
          setData(lanResults);
          onDataRef.current?.(lanResults);
          setError(null);
        } else {
          const error = err as Error;
          setError(error);
          onErrorRef.current?.(error);
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoizedQuery]);

  return { data, isLoading, error, refetch };
}

export function useDoc<T>(docRef: DocumentReference | null, options?: UseDocOptions<T>): UseDocResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const mountedRef = useRef(true);
  const onDataRef = useRef<((data: T | null) => void) | undefined>(undefined);
  const onErrorRef = useRef<((error: Error) => void) | undefined>(undefined);

  const { realtime = true, onData: onDataCallback, onError: onErrorCallback, disabled = false } = options || {};

  // Keep the callback refs up to date without triggering re-renders
  onDataRef.current = onDataCallback;
  onErrorRef.current = onErrorCallback;

  const memoizedDocRef = useMemo(
    () => docRef,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docRef]
  );

  useEffect(() => {
    if (disabled || !memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      return;
    }

    mountedRef.current = true;
    setIsLoading(true);

    // Clean up any existing subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // If not realtime, do a one-time fetch
    if (!realtime) {
      const fetchData = async () => {
        try {
          const docSnap = await getDoc(memoizedDocRef);

          if (mountedRef.current) {
            if (docSnap.exists()) {
              const result = { id: docSnap.id, ...docSnap.data() } as T;
              setData(result);
              onDataRef.current?.(result);
            } else {
              setData(null);
              onDataRef.current?.(null);
            }
            setError(null);
          }
        } catch (err) {
          console.error("useDoc fetch error:", err);
          if (mountedRef.current) {
            const error = err as Error;
            setError(error);
            onErrorRef.current?.(error);
          }
        } finally {
          if (mountedRef.current) {
            setIsLoading(false);
          }
        }
      };
      fetchData();
      return;
    }

    // Subscribe to Master Server Server-Sent Events (SSE) for instant single document updates
    let unsubscribeSse: (() => void) | null = null;
    try {
      const { lanSseClient } = require('@/lib/lan-sync/sse-client');
      const docPath = memoizedDocRef.path;
      const targetDocId = memoizedDocRef.id;

      unsubscribeSse = lanSseClient.subscribe((event: any) => {
        if (!mountedRef.current) return;
        if (event.docId === targetDocId) {
          if (event.action === 'delete') {
            setData(null);
            onDataRef.current?.(null);
          } else if (event.data) {
            const updated = { id: targetDocId, ...event.data } as T;
            setData(updated);
            onDataRef.current?.(updated);
          }
        }
      });
    } catch (e) {}

    // Set up real-time subscription
    const unsubscribe = onSnapshot(memoizedDocRef,
      (doc) => {
        if (mountedRef.current) {
          if (doc.exists()) {
            const result = { id: doc.id, ...doc.data() } as T;
            setData(result);
            onDataRef.current?.(result);
          } else {
            setData(null);
            onDataRef.current?.(null);
          }
          setIsLoading(false);
          setError(null);
        }
      },
      (err) => {
        console.error(`useDoc error on path: ${memoizedDocRef.path}`, err);
        if (mountedRef.current) {
          setError(err);
          onErrorRef.current?.(err);
          setIsLoading(false);
        }
      }
    );

    unsubscribeRef.current = () => {
      unsubscribe();
      if (unsubscribeSse) unsubscribeSse();
    };

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoizedDocRef, realtime, disabled]);

  const refetch = useCallback(async () => {
    if (!memoizedDocRef) return;

    setIsLoading(true);
    try {
      const docSnap = await getDoc(memoizedDocRef);

      if (mountedRef.current) {
        if (docSnap.exists()) {
          const result = { id: docSnap.id, ...docSnap.data() } as T;
          setData(result);
          onDataRef.current?.(result);
        } else {
          setData(null);
          onDataRef.current?.(null);
        }
        setError(null);
      }
    } catch (err) {
      console.error("useDoc refetch error:", err);
      if (mountedRef.current) {
        const error = err as Error;
        setError(error);
        onErrorRef.current?.(error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoizedDocRef]);

  return { data, isLoading, error, refetch };
}

// Custom hook to memoize Firestore queries/refs
// NOTE: This hook is now simplified and uses useMemo directly
// The original implementation had issues with the effect dependency
export const useMemoFirebase = <T extends Query | DocumentReference | null>(
  factory: () => T,
  deps: React.DependencyList
): T => {
  return useMemo(factory, deps);
};

// Helper to compare Firestore queries
function areQueriesEqual(q1: any, q2: any): boolean {
  if (q1 === q2) return true;
  if (!q1 || !q2) return false;
  if (q1.path !== q2.path) return false;
  // This uses the official Firestore SDK method for equality check
  return queryEqual(q1, q2);
}
