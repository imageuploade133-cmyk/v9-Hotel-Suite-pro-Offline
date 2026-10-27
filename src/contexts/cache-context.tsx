'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { firestoreCache, CacheTTL, CacheKeys, CacheEntry } from '@/lib/firestore-cache';

interface CacheContextType {
  /** Get data from cache */
  getCache: <T>(key: string) => T | null;
  /** Set data in cache with optional TTL */
  setCache: (key: string, value: any, ttl?: number) => void;
  /** Clear all cache */
  clearCache: () => void;
  /** Invalidate a specific key */
  invalidateKey: (key: string) => boolean;
  /** Invalidate all keys matching a pattern */
  invalidatePattern: (pattern: string) => number;
  /** Invalidate all data for a collection */
  invalidateCollection: (collection: string) => number;
  /** Get cache statistics */
  getStats: () => { hits: number; misses: number; size: number; hitRate: number; lastCleanup: number };
  /** Prefetch data into cache */
  prefetch: <T>(key: string, fetcher: () => Promise<T>, ttl?: number) => Promise<void>;
  /** Get or fetch with deduplication */
  getOrFetch: <T>(key: string, fetcher: () => Promise<T>, ttl?: number) => Promise<T>;
  /** Check if key exists and is valid */
  has: (key: string) => boolean;
  /** Whether the cache is currently loading from storage */
  isLoading: boolean;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

export const useCache = () => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('useCache must be used within a CacheProvider');
  }
  return context;
};

export const CacheProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [, forceUpdate] = useState({});
  const initializedRef = useRef(false);

  // Initialize cache on mount
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      setIsLoading(false);
    }
  }, []);

  const getCache = useCallback(<T,>(key: string): T | null => {
    return firestoreCache.get<T>(key);
  }, []);

  const setCache = useCallback((key: string, value: any, ttl: number = CacheTTL.MEDIUM) => {
    firestoreCache.set(key, value, ttl);
    forceUpdate({});
  }, []);

  const clearCache = useCallback(() => {
    firestoreCache.clear();
    forceUpdate({});
  }, []);

  const invalidateKey = useCallback((key: string): boolean => {
    const result = firestoreCache.delete(key);
    forceUpdate({});
    return result;
  }, []);

  const invalidatePattern = useCallback((pattern: string): number => {
    const result = firestoreCache.deletePattern(pattern);
    forceUpdate({});
    return result;
  }, []);

  const invalidateCollection = useCallback((collection: string): number => {
    const result = firestoreCache.invalidateCollection(collection);
    forceUpdate({});
    return result;
  }, []);

  const getStats = useCallback(() => {
    return firestoreCache.getStats();
  }, []);

  const prefetch = useCallback(async <T,>(key: string, fetcher: () => Promise<T>, ttl: number = CacheTTL.MEDIUM): Promise<void> => {
    await firestoreCache.prefetch(key, fetcher, ttl);
  }, []);

  const getOrFetch = useCallback(async <T,>(key: string, fetcher: () => Promise<T>, ttl: number = CacheTTL.MEDIUM): Promise<T> => {
    return firestoreCache.getOrFetch(key, fetcher, ttl);
  }, []);

  const has = useCallback((key: string): boolean => {
    return firestoreCache.has(key);
  }, []);

  const value = useMemo<CacheContextType>(
    () => ({
      getCache,
      setCache,
      clearCache,
      invalidateKey,
      invalidatePattern,
      invalidateCollection,
      getStats,
      prefetch,
      getOrFetch,
      has,
      isLoading,
    }),
    [
      getCache,
      setCache,
      clearCache,
      invalidateKey,
      invalidatePattern,
      invalidateCollection,
      getStats,
      prefetch,
      getOrFetch,
      has,
      isLoading,
    ]
  );

  return (
    <CacheContext.Provider value={value}>
      {children}
    </CacheContext.Provider>
  );
};

// Re-export cache utilities for convenience
export { CacheTTL, CacheKeys };
