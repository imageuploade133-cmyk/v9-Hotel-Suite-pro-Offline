'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useCache } from '@/contexts/cache-context';
import { useConnectivity } from '@/contexts/connectivity-context';
import { CacheTTL } from '@/lib/firestore-cache';

interface UsePageCacheProps<T, F> {
  /** Function to fetch fresh data */
  fetchData: () => Promise<T | null>;
  /** Initial filter values (for cache key generation) */
  initialFilters: F;
  /** Dependencies that trigger a refetch */
  dependencies: any[];
  /** Custom cache key (defaults to current pathname) */
  cacheKey?: string;
  /** Time to live in milliseconds */
  ttl?: number;
  /** Whether to fetch fresh data in background when cache exists - DISABLED by default for faster loads */
  staleWhileRevalidate?: boolean;
  /** Whether to disable caching */
  disabled?: boolean;
}

interface PageCacheResult<T> {
  /** The cached or fetched data */
  data: T | null;
  /** Whether this is the initial load (no cache available) */
  isLoading: boolean;
  /** Whether data is currently being fetched */
  isFetching: boolean;
  /** Whether data was restored from cache */
  isRestoring: boolean;
  /** Whether there's newer data available on server */
  hasUpdate: boolean;
  /** Whether data came from cache */
  isFromCache: boolean;
  /** Manually refresh data */
  refreshData: () => Promise<void>;
  /** Clear cache and refetch */
  clearAndRefetch: () => Promise<void>;
  /** Error if fetch failed */
  error: Error | null;
}

/**
 * Hook for page-level data caching with stale-while-revalidate pattern
 *
 * @example
 * const { data, isLoading, hasUpdate, refreshData } = usePageCache({
 *   fetchData: async () => {
 *     const snapshot = await getDocs(collection(firestore, 'bookings'));
 *     return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
 *   },
 *   initialFilters: { dateRange: null },
 *   dependencies: [dateRange],
 * });
 */
export function usePageCache<T, F>({
  fetchData,
  initialFilters,
  dependencies,
  cacheKey: customCacheKey,
  ttl = CacheTTL.MEDIUM,
  staleWhileRevalidate = false,
  disabled = false,
}: UsePageCacheProps<T, F>): PageCacheResult<T> {
  const { getCache, setCache, invalidateKey } = useCache();
  const isOnline = useConnectivity();

  // Generate cache key from pathname and filters
  const cacheKey = useMemo(() => {
    if (customCacheKey) return customCacheKey;
    if (typeof window === 'undefined') return 'default-page-cache';

    const pathname = window.location.pathname;
    const filterKey = Object.entries(initialFilters)
      .filter(([_, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join('&');

    return filterKey ? `${pathname}?${filterKey}` : pathname;
  }, [customCacheKey, initialFilters]);

  // Try to get cached data immediately
  const cachedData = useMemo(() => {
    if (disabled) return null;
    return getCache<T>(cacheKey);
  }, [cacheKey, disabled, getCache]);

  const [data, setData] = useState<T | null>(cachedData || null);
  const [isLoading, setIsLoading] = useState<boolean>(!cachedData && !disabled);
  const [isFetching, setIsFetching] = useState<boolean>(!cachedData && !disabled);
  const [isRestoring, setIsRestoring] = useState<boolean>(!!cachedData);
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [isFromCache, setIsFromCache] = useState<boolean>(!!cachedData);
  const [error, setError] = useState<Error | null>(null);

  const backgroundFetchCompleted = useRef(false);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  // Stabilize fetchData reference
  const stableFetchData = useCallback(fetchData, dependencies);

  // Perform fetch
  const performFetch = useCallback(async (isBackground: boolean, forceCache: boolean = false) => {
    // Prevent duplicate concurrent fetches for the same data
    if (fetchingRef.current && !isBackground) return;
    fetchingRef.current = true;

    if (!isOnline && !isBackground) {
      setIsLoading(false);
      setIsFetching(false);
      setError(new Error('Offline - showing cached data'));
      fetchingRef.current = false;
      return;
    }

    if (!isBackground) {
      setIsLoading(true);
      setIsFetching(true);
    }
    setError(null);

    try {
      const fetchedData = await stableFetchData();

      if (!mountedRef.current) return;

      if (fetchedData !== null) {
        // Check if data is different from cache
        const cached = getCache<T>(cacheKey);
        const isDifferent = !cached || JSON.stringify(cached) !== JSON.stringify(fetchedData);

        setData(fetchedData);
        setIsFromCache(false);
        setCache(cacheKey, fetchedData, ttl);

        if (isBackground && isDifferent && cached) {
          setHasUpdate(true);
        }

        backgroundFetchCompleted.current = true;
      }

      if (!isBackground) {
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Failed to fetch page data:', err);
      if (!isBackground && mountedRef.current) {
        setError(err as Error);
        setIsLoading(false);
      }
    } finally {
      if (!isBackground && mountedRef.current) {
        setIsFetching(false);
      }
      fetchingRef.current = false;
    }
  }, [stableFetchData, isOnline, setCache, getCache, cacheKey, ttl]);

  // Effect for data fetching
  useEffect(() => {
    if (disabled) {
      setData(null);
      setIsLoading(false);
      setIsFetching(false);
      setIsRestoring(false);
      return;
    }

    mountedRef.current = true;

    if (cachedData) {
      // We have cached data
      setData(cachedData);
      setIsFromCache(true);
      setIsRestoring(true);
      setIsLoading(false);

      if (staleWhileRevalidate && isOnline) {
        // Fetch fresh data in background
        performFetch(true).finally(() => {
          if (mountedRef.current) {
            setIsRestoring(false);
          }
        });
      } else {
        setIsRestoring(false);
      }
    } else {
      // No cache, fetch fresh
      performFetch(false).finally(() => {
        if (mountedRef.current) {
          setIsRestoring(false);
        }
      });
    }

    return () => {
      mountedRef.current = false;
    };
  // Only re-run when key dependencies change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, disabled, isOnline, staleWhileRevalidate]);

  // Manual refresh
  const refreshData = useCallback(async () => {
    setHasUpdate(false);
    setIsFromCache(false);
    await performFetch(false);
  }, [performFetch]);

  // Clear cache and refetch
  const clearAndRefetch = useCallback(async () => {
    invalidateKey(cacheKey);
    setHasUpdate(false);
    setIsFromCache(false);
    setData(null);
    await performFetch(false, true);
  }, [invalidateKey, cacheKey, performFetch]);

  return {
    data,
    isLoading: isLoading || isRestoring,
    isFetching,
    isRestoring,
    hasUpdate,
    isFromCache,
    refreshData,
    clearAndRefetch,
    error,
  };
}

/**
 * Simplified hook for caching computed values
 */
export function useCachedValue<T>(
  key: string,
  compute: () => T,
  ttl: number = CacheTTL.LONG
): T {
  const { getCache, setCache } = useCache();

  const cached = getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  const value = compute();
  setCache(key, value, ttl);
  return value;
}

/**
 * Hook for debounced cache updates
 */
export function useDebouncedCache<T>(
  key: string,
  value: T,
  delay: number = 500
): void {
  const { setCache } = useCache();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousValueRef = useRef<T>(value);

  useEffect(() => {
    // Only update if value changed
    if (JSON.stringify(previousValueRef.current) === JSON.stringify(value)) {
      return;
    }

    previousValueRef.current = value;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setCache(key, value);
      timeoutRef.current = null;
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [key, value, delay, setCache]);
}
