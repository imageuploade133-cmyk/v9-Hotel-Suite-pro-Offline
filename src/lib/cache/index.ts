/**
 * Firestore Cache - Main Export
 */

// Core cache manager
export { firestoreCache, CacheTTL, CacheKeys } from '../firestore-cache';
export type { CacheEntry, CacheStats } from '../firestore-cache';

// Batch operations
export {
    batchFetchDocuments,
    batchFetchByField,
    fetchPaginatedCollection,
    batchWrite,
    optimisticUpdate,
    createDocument,
    deleteDocument,
    prefetchRelated,
} from '../firestore-batch-fetch';
export type { BatchFetchOptions, PaginatedFetchOptions } from '../firestore-batch-fetch';

// React hooks
export { useCachedCollection, useCachedDocument, useCachedDocuments, usePrefetch, useCacheInvalidation, useCacheStats } from '@/hooks/use-cached-firestore';
export { useBatchFetch, useBatchFetchByField, usePaginatedCollection, useInfiniteScroll } from '@/hooks/use-batch-fetch';
export { usePageCache, useCachedValue, useDebouncedCache } from '@/hooks/use-page-cache';
export { useCacheWarming, usePrefetchOnHover, CacheWarmingProvider, CacheStats } from '@/components/cache/cache-warming-provider';

// Context
export { useCache, CacheProvider } from '@/contexts/cache-context';
