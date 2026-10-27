'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { firestoreCache, CacheTTL, CacheKeys } from '@/lib/firestore-cache';

interface CacheWarmingOptions {
    /** Whether to warm cache on mount */
    warmOnMount?: boolean;
    /** Delay before warming cache (ms) */
    warmDelay?: number;
    /** Collections to preload */
    collections?: string[];
    /** Whether to warm critical data only */
    criticalOnly?: boolean;
}

/**
 * Critical collections that are frequently accessed
 */
const CRITICAL_COLLECTIONS = [
    { name: 'settings', ttl: CacheTTL.HOUR, limit: 10 },
    { name: 'rooms', ttl: CacheTTL.HOUR, limit: 100 },
    { name: 'users', ttl: CacheTTL.LONG, limit: 100 },
    { name: 'paymentMethods', ttl: CacheTTL.HOUR, limit: 10 },
];

/**
 * Semi-critical collections for operations
 */
const OPERATIONAL_COLLECTIONS = [
    { name: 'bookings', ttl: CacheTTL.SHORT, limit: 500 },
    { name: 'payments', ttl: CacheTTL.MEDIUM, limit: 500 },
    { name: 'stock', ttl: CacheTTL.MEDIUM, limit: 500 },
    { name: 'stockSales', ttl: CacheTTL.MEDIUM, limit: 500 },
];

/**
 * Hook for warming up the cache with frequently accessed data
 */
export function useCacheWarming(options: CacheWarmingOptions = {}) {
    const {
        warmOnMount = true,
        warmDelay = 1000,
        collections = [],
        criticalOnly = true,
    } = options;

    const firestore = useFirestore();
    const warmedRef = useRef(false);

    const warmCache = useCallback(async () => {
        if (!firestore || warmedRef.current) return;

        warmedRef.current = true;

        const collectionsToWarm = collections.length > 0
            ? collections.map(name => ({ name, ttl: CacheTTL.MEDIUM, limit: 100 }))
            : criticalOnly
                ? CRITICAL_COLLECTIONS
                : [...CRITICAL_COLLECTIONS, ...OPERATIONAL_COLLECTIONS];

        // Warm cache in parallel with priority
        const warmPromises = collectionsToWarm.map(async ({ name, ttl, limit: collectionLimit }) => {
            const cacheKey = CacheKeys.collection(name);

            // Skip if already cached
            if (firestoreCache.has(cacheKey)) {
                return;
            }

            try {
                const ref = collection(firestore, name);
                const q = query(ref, limit(collectionLimit));
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                if (data.length > 0) {
                    firestoreCache.set(cacheKey, data, ttl);
                }
            } catch (error) {
                console.warn(`Failed to warm cache for ${name}:`, error);
            }
        });

        await Promise.allSettled(warmPromises);
    }, [firestore, collections, criticalOnly]);

    useEffect(() => {
        if (warmOnMount && firestore) {
            const timeoutId = setTimeout(warmCache, warmDelay);
            return () => clearTimeout(timeoutId);
        }
    }, [warmOnMount, warmDelay, warmCache, firestore]);

    return { warmCache, isWarmed: warmedRef.current };
}

/**
 * Hook for prefetching data before navigation
 * DISABLED: Prefetching is disabled to improve page load performance.
 * Data is fetched on-demand when needed.
 */
export function usePrefetchOnHover() {
    // Prefetching disabled - was causing unnecessary data fetching
    const prefetchOnHover = useCallback((_collectionName: string) => {
        // No-op - prefetching disabled for performance
    }, []);

    return prefetchOnHover;
}

/**
 * Provider component that warms cache on app load
 * DISABLED: Cache warming is disabled to improve initial page load performance.
 * Data is fetched on-demand when pages need it.
 */
export function CacheWarmingProvider({ children }: { children: React.ReactNode }) {
    // Cache warming disabled - was causing slow page loads
    // useCacheWarming({
    //     warmOnMount: true,
    //     warmDelay: 2000,
    //     criticalOnly: true,
    // });

    return <>{children}</>;
}

/**
 * Component to display cache statistics (for debugging)
 */
export function CacheStats() {
    const stats = firestoreCache.getStats();

    if (process.env.NODE_ENV !== 'development') {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white p-2 rounded text-xs font-mono z-50">
            <div>Cache: {stats.size} entries</div>
            <div>Hits: {stats.hits} | Misses: {stats.misses}</div>
            <div>Hit Rate: {(stats.hitRate * 100).toFixed(1)}%</div>
        </div>
    );
}
