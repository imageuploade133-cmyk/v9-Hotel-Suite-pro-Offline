/**
 * Cached Firestore Hooks
 *
 * React hooks that integrate with the Firestore cache system
 * to minimize reads and provide offline-first data access.
 */

'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Firestore,
  Query,
  CollectionReference,
  DocumentReference,
  onSnapshot,
  getDoc,
  getDocs,
  Unsubscribe,
  doc,
  collection,
  query as firestoreQuery,
  where,
  orderBy,
  limit,
  startAfter,
  endAt,
} from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { firestoreCache, CacheTTL, CacheKeys } from '@/lib/firestore-cache';

// Re-export cache utilities for convenience
export { CacheTTL, CacheKeys, firestoreCache };

export interface UseCachedCollectionOptions<T> {
  /** Time to live in milliseconds */
  ttl?: number;
  /** Whether to subscribe to real-time updates after initial cache load */
  realtime?: boolean;
  /** Whether to return cached data immediately while fetching fresh data */
  staleWhileRevalidate?: boolean;
  /** Transform function for the data */
  transform?: (data: any[]) => T[];
  /** Called when data is updated */
  onData?: (data: T[]) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Whether the query is disabled */
  disabled?: boolean;
  /** Custom cache key */
  cacheKey?: string;
}

export interface UseCachedDocumentOptions<T> {
  ttl?: number;
  realtime?: boolean;
  staleWhileRevalidate?: boolean;
  transform?: (data: any) => T;
  onData?: (data: T | null) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  cacheKey?: string;
}

export interface CachedQueryResult<T> {
  data: T[];
  isLoading: boolean;
  isFetching: boolean;
  isFromCache: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface CachedDocumentResult<T> {
  data: T | null;
  isLoading: boolean;
  isFetching: boolean;
  isFromCache: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching a cached collection with optional real-time updates
 */
export function useCachedCollection<T>(
  query: Query | CollectionReference | null,
  options: UseCachedCollectionOptions<T> = {}
): CachedQueryResult<T> {
  const {
    ttl = CacheTTL.MEDIUM,
    realtime = true,
    staleWhileRevalidate = false,
    transform,
    onData,
    onError,
    disabled = false,
    cacheKey: customCacheKey,
  } = options;

  const firestore = useFirestore();
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const mountedRef = useRef(true);
  const lastQueryRef = useRef<Query | CollectionReference | null>(null);

  // Memoize query
  const memoizedQuery = useMemoFirebase(() => query, [query]);

  // Generate cache key
  const cacheKey = useMemo(() => {
    if (customCacheKey) return customCacheKey;
    if (!memoizedQuery) return null;
    // Use the path as the base key
    const path = (memoizedQuery as any)._path?.segments?.join(':') ||
                 (memoizedQuery as any)._queryOptions?.parentPath?.join(':') ||
                 'unknown';
    return CacheKeys.collection(path);
  }, [memoizedQuery, customCacheKey]);

  const memoizedOnData = useCallback(onData || (() => {}), [onData]);
  const memoizedOnError = useCallback(onError || (() => {}), [onError]);
  const memoizedTransform = useCallback(transform || ((d: any[]) => d as T[]), [transform]);

  // Fetch fresh data
  const fetchData = useCallback(async (showLoading = true) => {
    if (!memoizedQuery || !firestore) return;

    if (showLoading) {
      setIsFetching(true);
    }

    try {
      const snapshot = await getDocs(memoizedQuery);
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const transformed = memoizedTransform(results);

      if (mountedRef.current) {
        setData(transformed);
        setIsFromCache(false);
        setError(null);
        memoizedOnData(transformed);
      }

      // Update cache
      if (cacheKey) {
        firestoreCache.set(cacheKey, transformed, ttl);
      }
    } catch (err) {
      console.error('useCachedCollection error:', err);
      if (mountedRef.current) {
        setError(err as Error);
        setData([]);
        memoizedOnError(err as Error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [memoizedQuery, firestore, cacheKey, ttl, memoizedTransform, memoizedOnData, memoizedOnError]);

  // Initial load and real-time subscription setup
  useEffect(() => {
    if (disabled || !memoizedQuery) {
      setData([]);
      setIsLoading(false);
      setIsFetching(false);
      return;
    }

    mountedRef.current = true;

    // Check if query changed
    const queryChanged = lastQueryRef.current !== memoizedQuery;
    lastQueryRef.current = memoizedQuery;

    // Try to get cached data first
    if (cacheKey) {
      const cached = firestoreCache.get<T[]>(cacheKey);
      if (cached) {
        setData(cached);
        setIsFromCache(true);
        setIsLoading(false);

        if (staleWhileRevalidate) {
          // Fetch fresh data in background
          fetchData(false);
        } else if (!realtime) {
          return;
        }
      } else {
        // No cache, fetch fresh data
        fetchData(true);
      }
    } else {
      fetchData(true);
    }

    // Set up real-time subscription if enabled
    if (realtime) {
      const handleSnapshot = (snapshot: any) => {
        const results = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        const transformed = memoizedTransform(results);

        if (mountedRef.current) {
          setData(transformed);
          setIsFromCache(false);
          setIsLoading(false);
          setIsFetching(false);
          setError(null);
          memoizedOnData(transformed);
        }

        // Update cache
        if (cacheKey) {
          firestoreCache.set(cacheKey, transformed, ttl);
        }
      };

      const handleError = (err: Error) => {
        console.error('useCachedCollection subscription error:', err);
        if (mountedRef.current) {
          setError(err);
          setData([]);
          memoizedOnError(err);
        }
      };

      unsubscribeRef.current = onSnapshot(memoizedQuery, handleSnapshot, handleError);
    }

    return () => {
      mountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [
    memoizedQuery,
    disabled,
    cacheKey,
    realtime,
    staleWhileRevalidate,
    ttl,
    fetchData,
    memoizedTransform,
    memoizedOnData,
    memoizedOnError,
  ]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return { data, isLoading, isFetching, isFromCache, error, refetch };
}

/**
 * Hook for fetching a cached document with optional real-time updates
 */
export function useCachedDocument<T>(
  docRef: DocumentReference | null,
  options: UseCachedDocumentOptions<T> = {}
): CachedDocumentResult<T> {
  const {
    ttl = CacheTTL.MEDIUM,
    realtime = true,
    staleWhileRevalidate = false,
    transform,
    onData,
    onError,
    disabled = false,
    cacheKey: customCacheKey,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const mountedRef = useRef(true);

  // Memoize document reference
  const memoizedDocRef = useMemoFirebase(() => docRef, [docRef]);

  // Generate cache key
  const cacheKey = useMemo(() => {
    if (customCacheKey) return customCacheKey;
    if (!memoizedDocRef) return null;
    return CacheKeys.document(
      memoizedDocRef.parent.path,
      memoizedDocRef.id
    );
  }, [memoizedDocRef, customCacheKey]);

  const memoizedOnData = useCallback(onData || (() => {}), [onData]);
  const memoizedOnError = useCallback(onError || (() => {}), [onError]);
  const memoizedTransform = useCallback(transform || ((d: any) => d as T), [transform]);

  const fetchData = useCallback(async (showLoading = true) => {
    if (!memoizedDocRef) return;

    if (showLoading) {
      setIsFetching(true);
    }

    try {
      const doc = await getDoc(memoizedDocRef);

      if (mountedRef.current) {
        if (doc.exists()) {
          const result = { id: doc.id, ...doc.data() };
          const transformed = memoizedTransform(result);
          setData(transformed);
          setIsFromCache(false);
          memoizedOnData(transformed);

          if (cacheKey) {
            firestoreCache.set(cacheKey, transformed, ttl);
          }
        } else {
          setData(null);
          memoizedOnData(null);
        }
        setError(null);
      }
    } catch (err) {
      console.error('useCachedDocument error:', err);
      if (mountedRef.current) {
        setError(err as Error);
        memoizedOnError(err as Error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [memoizedDocRef, cacheKey, ttl, memoizedTransform, memoizedOnData, memoizedOnError]);

  useEffect(() => {
    if (disabled || !memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setIsFetching(false);
      return;
    }

    mountedRef.current = true;

    // Try cache first
    if (cacheKey) {
      const cached = firestoreCache.get<T>(cacheKey);
      if (cached) {
        setData(cached);
        setIsFromCache(true);
        setIsLoading(false);

        if (staleWhileRevalidate) {
          fetchData(false);
        } else if (!realtime) {
          return;
        }
      } else {
        fetchData(true);
      }
    } else {
      fetchData(true);
    }

    // Real-time subscription
    if (realtime) {
      const handleSnapshot = (doc: any) => {
        if (mountedRef.current) {
          if (doc.exists()) {
            const result = { id: doc.id, ...doc.data() };
            const transformed = memoizedTransform(result);
            setData(transformed);
            setIsFromCache(false);
            setIsLoading(false);
            setIsFetching(false);
            setError(null);
            memoizedOnData(transformed);

            if (cacheKey) {
              firestoreCache.set(cacheKey, transformed, ttl);
            }
          } else {
            setData(null);
            setIsFromCache(false);
            setIsLoading(false);
            setIsFetching(false);
            memoizedOnData(null);
          }
        }
      };

      const handleError = (err: Error) => {
        console.error('useCachedDocument subscription error:', err);
        if (mountedRef.current) {
          setError(err);
          memoizedOnError(err);
        }
      };

      unsubscribeRef.current = onSnapshot(memoizedDocRef, handleSnapshot, handleError);
    }

    return () => {
      mountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [
    memoizedDocRef,
    disabled,
    cacheKey,
    realtime,
    staleWhileRevalidate,
    ttl,
    fetchData,
    memoizedTransform,
    memoizedOnData,
    memoizedOnError,
  ]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return { data, isLoading, isFetching, isFromCache, error, refetch };
}

/**
 * Hook for batch fetching multiple documents
 */
export function useCachedDocuments<T>(
  firestore: Firestore | null,
  collection: string,
  ids: string[],
  options: Omit<UseCachedDocumentOptions<T>, 'cacheKey'> = {}
): { data: Map<string, T>; isLoading: boolean; errors: Error[] } {
  const { ttl = CacheTTL.MEDIUM, transform } = options;

  const [data, setData] = useState<Map<string, T>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<Error[]>([]);

  const memoizedIds = useMemo(() => ids.sort().join(','), [ids]);
  const memoizedTransform = useCallback(transform || ((d: any) => d as T), [transform]);

  useEffect(() => {
    if (!firestore || ids.length === 0) {
      setData(new Map());
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const results = new Map<string, T>();
    const idsToFetch: string[] = [];

    // Check cache for each ID
    ids.forEach(id => {
      const cacheKey = CacheKeys.document(collection, id);
      const cached = firestoreCache.get<T>(cacheKey);
      if (cached) {
        results.set(id, cached);
      } else {
        idsToFetch.push(id);
      }
    });

    // Update with cached data immediately
    if (results.size > 0) {
      setData(new Map(results));
      setIsLoading(idsToFetch.length > 0);
    }

    // Fetch remaining documents
    if (idsToFetch.length > 0) {
      const fetchPromises = idsToFetch.map(async id => {
        const docRef = doc(firestore, collection, id);
        const document = await getDoc(docRef);
        if (document.exists()) {
          const result = { id: document.id, ...document.data() };
          const transformed = memoizedTransform(result);

          // Cache it
          const cacheKey = CacheKeys.document(collection, id);
          firestoreCache.set(cacheKey, transformed, ttl);

          return { id, data: transformed };
        }
        return null;
      });

      Promise.all(fetchPromises).then(fetched => {
        if (!cancelled) {
          fetched.forEach(item => {
            if (item) {
              results.set(item.id, item.data);
            }
          });
          setData(new Map(results));
          setIsLoading(false);
        }
      }).catch(err => {
        if (!cancelled) {
          setErrors([err]);
          setIsLoading(false);
        }
      });
    } else {
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [firestore, collection, memoizedIds, ttl, memoizedTransform, ids]);

  return { data, isLoading, errors };
}

/**
 * Hook for prefetching data
 */
export function usePrefetch() {
  const firestore = useFirestore();

  const prefetchCollection = useCallback(async <T>(
    collectionName: string,
    queryBuilder?: (ref: CollectionReference) => Query,
    ttl: number = CacheTTL.MEDIUM
  ): Promise<void> => {
    if (!firestore) return;

    const ref = collection(firestore, collectionName);
    const q = queryBuilder ? queryBuilder(ref) : ref;
    const cacheKey = CacheKeys.collection(collectionName);

    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    firestoreCache.set(cacheKey, data, ttl);
  }, [firestore]);

  const prefetchDocument = useCallback(async <T>(
    collectionName: string,
    docId: string,
    ttl: number = CacheTTL.MEDIUM
  ): Promise<void> => {
    if (!firestore) return;

    const docRef = doc(firestore, collectionName, docId);
    const document = await getDoc(docRef);

    if (document.exists()) {
      const data = { id: document.id, ...document.data() };
      const cacheKey = CacheKeys.document(collectionName, docId);
      firestoreCache.set(cacheKey, data, ttl);
    }
  }, [firestore]);

  const prefetchUser = useCallback(async (uid: string): Promise<void> => {
    await prefetchDocument('users', uid, CacheTTL.LONG);
  }, [prefetchDocument]);

  const prefetchSettings = useCallback(async (): Promise<void> => {
    if (!firestore) return;

    const settingsSnapshot = await getDocs(collection(firestore, 'settings'));
    const settings: Record<string, any> = {};
    settingsSnapshot.forEach(doc => {
      Object.assign(settings, doc.data());
    });
    firestoreCache.set(CacheKeys.settings(), settings, CacheTTL.HOUR);
  }, [firestore]);

  return {
    prefetchCollection,
    prefetchDocument,
    prefetchUser,
    prefetchSettings,
  };
}

/**
 * Hook for cache invalidation
 */
export function useCacheInvalidation() {
  const invalidateCollection = useCallback((collection: string) => {
    return firestoreCache.invalidateCollection(collection);
  }, []);

  const invalidateDocument = useCallback((collection: string, docId: string) => {
    const key = CacheKeys.document(collection, docId);
    return firestoreCache.delete(key);
  }, []);

  const invalidateUser = useCallback((uid: string) => {
    return firestoreCache.delete(CacheKeys.user(uid));
  }, []);

  const invalidateAll = useCallback(() => {
    firestoreCache.clear();
  }, []);

  const invalidatePattern = useCallback((pattern: string) => {
    return firestoreCache.deletePattern(pattern);
  }, []);

  return {
    invalidateCollection,
    invalidateDocument,
    invalidateUser,
    invalidateAll,
    invalidatePattern,
  };
}

/**
 * Hook to access cache statistics
 */
export function useCacheStats() {
  const [stats, setStats] = useState(firestoreCache.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(firestoreCache.getStats());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return stats;
}
