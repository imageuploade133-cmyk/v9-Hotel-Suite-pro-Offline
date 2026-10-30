'use client';

import { useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore, collection, onSnapshot, Query, DocumentData, CollectionReference, getDocs, DocumentReference, doc, queryEqual, Unsubscribe } from 'firebase/firestore';
import { FirebaseClientProvider } from './client-provider';

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

async function fetchLanCollectionData<T>(pathStr: string): Promise<T[]> {
  try {
    const res = await fetch(`/api/lan-sync?collection=${encodeURIComponent(pathStr)}`);
    if (res.ok) {
      const result = await res.json();
      if (result.data) {
        return Object.entries(result.data).map(([id, val]: [string, any]) => ({
          id,
          ...(typeof val === 'object' ? val : {}),
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

    const pathStr = (memoizedQuery as any).path || 'collections';

    // If not realtime, do a one-time fetch
    if (!realtime) {
      const fetchData = async () => {
        try {
          const snapshot = await getDocs(memoizedQuery);
          let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));

          if (results.length === 0 && !navigator.onLine) {
            const lanResults = await fetchLanCollectionData<T>(pathStr);
            if (lanResults.length > 0) results = lanResults;
          }

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
      }
    });

    // Set up real-time subscription
    const unsubscribe = onSnapshot(memoizedQuery,
      (snapshot) => {
        const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
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

    unsubscribeRef.current = unsubscribe;

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
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));

      if (mountedRef.current) {
        setData(results);
        onDataRef.current?.(results);
        setError(null);
      }
    } catch (err) {
      console.error("useCollection refetch error:", err);
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
          const docSnap = await getDocs(doc(memoizedDocRef.parent, memoizedDocRef.id));

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

    unsubscribeRef.current = unsubscribe;

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
      const docSnap = await getDocs(doc(memoizedDocRef.parent, memoizedDocRef.id));

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
