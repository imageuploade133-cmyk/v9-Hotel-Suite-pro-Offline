'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFirestore } from '@/firebase';
import {
    batchFetchDocuments,
    batchFetchByField,
    fetchPaginatedCollection,
    BatchFetchOptions,
    PaginatedFetchOptions,
} from '@/lib/firestore-batch-fetch';
import { CacheTTL } from '@/lib/firestore-cache';

/**
 * Hook for batch fetching documents by IDs
 */
export function useBatchFetch<T>(
    collectionName: string,
    ids: string[],
    options: BatchFetchOptions = {}
) {
    const firestore = useFirestore();
    const [data, setData] = useState<Map<string, T>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Stable reference to sorted IDs
    const idsKey = ids.sort().join(',');

    useEffect(() => {
        if (!firestore || ids.length === 0) {
            setData(new Map());
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        const fetch = async () => {
            setIsLoading(true);
            try {
                const results = await batchFetchDocuments<T>(
                    firestore,
                    collectionName,
                    ids,
                    options
                );

                if (!cancelled) {
                    setData(results);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err as Error);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetch();

        return () => {
            cancelled = true;
        };
    }, [firestore, collectionName, idsKey, options]);

    const refetch = useCallback(async () => {
        if (!firestore || ids.length === 0) return;

        setIsLoading(true);
        try {
            const results = await batchFetchDocuments<T>(
                firestore,
                collectionName,
                ids,
                { ...options, forceRefresh: true }
            );
            setData(results);
            setError(null);
        } catch (err) {
            setError(err as Error);
        } finally {
            setIsLoading(false);
        }
    }, [firestore, collectionName, ids, options]);

    return { data, isLoading, error, refetch };
}

/**
 * Hook for batch fetching documents by a field value
 */
export function useBatchFetchByField<T>(
    collectionName: string,
    field: string,
    values: any[],
    options: BatchFetchOptions = {}
) {
    const firestore = useFirestore();
    const [data, setData] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Stable reference to values
    const valuesKey = JSON.stringify(values?.sort() || []);

    useEffect(() => {
        if (!firestore || !values || values.length === 0) {
            setData([]);
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        const fetch = async () => {
            setIsLoading(true);
            try {
                const results = await batchFetchByField<T>(
                    firestore,
                    collectionName,
                    field,
                    values,
                    options
                );

                if (!cancelled) {
                    setData(results);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err as Error);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetch();

        return () => {
            cancelled = true;
        };
    }, [firestore, collectionName, field, valuesKey, options]);

    const refetch = useCallback(async () => {
        if (!firestore || !values || values.length === 0) return;

        setIsLoading(true);
        try {
            const results = await batchFetchByField<T>(
                firestore,
                collectionName,
                field,
                values,
                { ...options, forceRefresh: true }
            );
            setData(results);
            setError(null);
        } catch (err) {
            setError(err as Error);
        } finally {
            setIsLoading(false);
        }
    }, [firestore, collectionName, field, values, options]);

    return { data, isLoading, error, refetch };
}

/**
 * Hook for paginated collection fetching
 */
export function usePaginatedCollection<T>(
    collectionName: string,
    options: PaginatedFetchOptions = {}
) {
    const firestore = useFirestore();
    const [data, setData] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [hasPrevious, setHasPrevious] = useState(false);

    const lastDocRef = useRef<any>(null);
    const firstDocRef = useRef<any>(null);
    const historyRef = useRef<any[]>([]);

    // Fetch initial page
    const fetchPage = useCallback(async (direction: 'initial' | 'next' | 'previous' = 'initial') => {
        if (!firestore) return;

        setIsLoading(true);
        try {
            let fetchOptions: PaginatedFetchOptions = { ...options };

            if (direction === 'next' && lastDocRef.current) {
                fetchOptions.startAfter = lastDocRef.current;
            } else if (direction === 'previous' && firstDocRef.current) {
                fetchOptions.endBefore = firstDocRef.current;
            }

            const result = await fetchPaginatedCollection<T>(
                firestore,
                collectionName,
                fetchOptions
            );

            if (direction === 'next') {
                historyRef.current.push(firstDocRef.current);
            } else if (direction === 'previous') {
                historyRef.current.pop();
            }

            setData(result.data);
            setHasMore(result.hasMore);
            setHasPrevious(historyRef.current.length > 0 || direction === 'next');
            lastDocRef.current = result.lastDoc;
            firstDocRef.current = result.firstDoc;
            setError(null);
        } catch (err) {
            setError(err as Error);
        } finally {
            setIsLoading(false);
        }
    }, [firestore, collectionName, options]);

    // Initial fetch
    useEffect(() => {
        fetchPage('initial');
    }, [fetchPage]);

    const loadMore = useCallback(() => {
        if (hasMore && !isLoading) {
            fetchPage('next');
        }
    }, [hasMore, isLoading, fetchPage]);

    const loadPrevious = useCallback(() => {
        if (hasPrevious && !isLoading) {
            fetchPage('previous');
        }
    }, [hasPrevious, isLoading, fetchPage]);

    const refresh = useCallback(() => {
        lastDocRef.current = null;
        firstDocRef.current = null;
        historyRef.current = [];
        fetchPage('initial');
    }, [fetchPage]);

    return {
        data,
        isLoading,
        error,
        hasMore,
        hasPrevious,
        loadMore,
        loadPrevious,
        refresh,
    };
}

/**
 * Hook for infinite scrolling
 */
export function useInfiniteScroll<T>(
    collectionName: string,
    options: PaginatedFetchOptions = {}
) {
    const firestore = useFirestore();
    const [data, setData] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const lastDocRef = useRef<any>(null);
    const fetchedPages = useRef(0);

    const fetchNextPage = useCallback(async (append: boolean = true) => {
        if (!firestore || (!append && fetchedPages.current > 0)) return;

        if (append) {
            setIsFetchingMore(true);
        } else {
            setIsLoading(true);
        }

        try {
            const fetchOptions: PaginatedFetchOptions = {
                ...options,
                startAfter: append ? lastDocRef.current : undefined,
            };

            const result = await fetchPaginatedCollection<T>(
                firestore,
                collectionName,
                fetchOptions
            );

            if (append) {
                setData(prev => [...prev, ...result.data]);
            } else {
                setData(result.data);
            }

            setHasMore(result.hasMore);
            lastDocRef.current = result.lastDoc;
            fetchedPages.current++;
            setError(null);
        } catch (err) {
            setError(err as Error);
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, [firestore, collectionName, options]);

    // Initial fetch
    useEffect(() => {
        setData([]);
        lastDocRef.current = null;
        fetchedPages.current = 0;
        fetchNextPage(false);
    }, [fetchNextPage]);

    const loadMore = useCallback(() => {
        if (hasMore && !isFetchingMore) {
            fetchNextPage(true);
        }
    }, [hasMore, isFetchingMore, fetchNextPage]);

    const refresh = useCallback(() => {
        setData([]);
        lastDocRef.current = null;
        fetchedPages.current = 0;
        setHasMore(true);
        fetchNextPage(false);
    }, [fetchNextPage]);

    return {
        data,
        isLoading,
        isFetchingMore,
        error,
        hasMore,
        loadMore,
        refresh,
    };
}
