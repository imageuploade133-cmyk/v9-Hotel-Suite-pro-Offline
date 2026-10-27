/**
 * Batch Firestore Operations
 *
 * Utilities for efficiently fetching and caching related data in batches.
 * Reduces the number of Firestore reads by:
 * - Batching multiple document fetches
 * - Using cached data when available
 * - Deduplicating concurrent requests
 */

import {
    Firestore,
    DocumentReference,
    CollectionReference,
    Query,
    doc,
    getDoc,
    getDocs,
    writeBatch,
    deleteDoc,
    updateDoc,
    setDoc,
    addDoc,
    collection,
    query as createQuery,
    where,
    documentId,
    orderBy,
    limit,
    startAfter,
    endBefore,
    limitToLast,
} from 'firebase/firestore';
import { firestoreCache, CacheTTL, CacheKeys } from './firestore-cache';

export interface BatchFetchOptions {
    /** Maximum number of documents to fetch per batch (Firestore limit is 10) */
    batchSize?: number;
    /** Cache TTL for fetched documents */
    ttl?: number;
    /** Whether to skip cache and force fetch */
    forceRefresh?: boolean;
}

export interface PaginatedFetchOptions {
    /** Number of documents per page */
    pageSize?: number;
    /** Cache TTL */
    ttl?: number;
    /** Start after this document */
    startAfter?: any;
    /** End before this document */
    endBefore?: any;
}

/**
 * Batch fetch multiple documents by IDs
 * Efficiently fetches documents that aren't in cache and returns all requested docs
 */
export async function batchFetchDocuments<T>(
    firestore: Firestore,
    collectionName: string,
    ids: string[],
    options: BatchFetchOptions = {}
): Promise<Map<string, T>> {
    const { batchSize = 10, ttl = CacheTTL.MEDIUM, forceRefresh = false } = options;
    const results = new Map<string, T>();
    const idsToFetch: string[] = [];

    // Check cache first
    if (!forceRefresh) {
        for (const id of ids) {
            const cacheKey = CacheKeys.document(collectionName, id);
            const cached = firestoreCache.get<T>(cacheKey);
            if (cached) {
                results.set(id, cached);
            } else {
                idsToFetch.push(id);
            }
        }
    } else {
        idsToFetch.push(...ids);
    }

    // Fetch remaining documents in batches
    if (idsToFetch.length > 0) {
        for (let i = 0; i < idsToFetch.length; i += batchSize) {
            const batchIds = idsToFetch.slice(i, i + batchSize);

            // Firestore 'in' query supports up to 10 values
            const collectionRef = collection(firestore, collectionName);
            const q = createQuery(collectionRef, where(documentId(), 'in', batchIds));
            const snapshot = await getDocs(q);

            snapshot.forEach((doc) => {
                const data = { id: doc.id, ...doc.data() } as T;
                results.set(doc.id, data);

                // Cache the document
                const cacheKey = CacheKeys.document(collectionName, doc.id);
                firestoreCache.set(cacheKey, data, ttl);
            });
        }
    }

    return results;
}

/**
 * Batch fetch documents by a field value (e.g., all bookings for a user)
 */
export async function batchFetchByField<T>(
    firestore: Firestore,
    collectionName: string,
    field: string,
    values: any[],
    options: BatchFetchOptions = {}
): Promise<T[]> {
    const { batchSize = 10, ttl = CacheTTL.MEDIUM, forceRefresh = false } = options;
    const results: T[] = [];
    const cachedKeys = new Set<string>();

    // Generate cache key for this query
    const getQueryCacheKey = (vals: any[]) =>
        CacheKeys.query(collectionName, `${field}=${JSON.stringify(vals.sort())}`);

    // Check cache for the full query first
    if (!forceRefresh) {
        const queryCacheKey = getQueryCacheKey(values);
        const cached = firestoreCache.get<T[]>(queryCacheKey);
        if (cached) {
            return cached;
        }
    }

    // Fetch in batches (Firestore 'in' supports max 10 values)
    for (let i = 0; i < values.length; i += batchSize) {
        const batchValues = values.slice(i, i + batchSize);

        const collectionRef = collection(firestore, collectionName);
        const q = createQuery(collectionRef, where(field, 'in', batchValues));
        const snapshot = await getDocs(q);

        snapshot.forEach((doc) => {
            const data = { id: doc.id, ...doc.data() } as T;
            results.push(data);

            // Cache individual documents
            const docCacheKey = CacheKeys.document(collectionName, doc.id);
            firestoreCache.set(docCacheKey, data, ttl);
        });
    }

    // Cache the full query result
    const queryCacheKey = getQueryCacheKey(values);
    firestoreCache.set(queryCacheKey, results, ttl);

    return results;
}

/**
 * Fetch a collection with pagination and caching
 */
export async function fetchPaginatedCollection<T>(
    firestore: Firestore,
    collectionName: string,
    options: PaginatedFetchOptions = {}
): Promise<{ data: T[]; hasMore: boolean; lastDoc: any; firstDoc: any }> {
    const { pageSize = 20, ttl = CacheTTL.MEDIUM, startAfter: startAfterDoc, endBefore: endBeforeDoc } = options;

    const collectionRef = collection(firestore, collectionName);
    let q: Query;

    if (startAfterDoc) {
        q = createQuery(collectionRef, orderBy('createdAt', 'desc'), startAfter(startAfterDoc), limit(pageSize));
    } else if (endBeforeDoc) {
        q = createQuery(collectionRef, orderBy('createdAt', 'desc'), endBefore(endBeforeDoc), limitToLast(pageSize));
    } else {
        q = createQuery(collectionRef, orderBy('createdAt', 'desc'), limit(pageSize + 1));
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;

    const hasMore = docs.length > pageSize;
    const data = docs.slice(0, pageSize).map(doc => {
        const item = { id: doc.id, ...doc.data() } as T;

        // Cache individual documents
        const cacheKey = CacheKeys.document(collectionName, doc.id);
        firestoreCache.set(cacheKey, item, ttl);

        return item;
    });

    return {
        data,
        hasMore,
        lastDoc: docs[docs.length - 1] || null,
        firstDoc: docs[0] || null,
    };
}

/**
 * Batch write operations with automatic cache invalidation
 */
export async function batchWrite(
    firestore: Firestore,
    operations: Array<{
        type: 'set' | 'update' | 'delete';
        collection: string;
        id: string;
        data?: any;
    }>
): Promise<void> {
    const batch = writeBatch(firestore);
    const collectionsToInvalidate = new Set<string>();

    for (const op of operations) {
        const docRef = doc(firestore, op.collection, op.id);

        switch (op.type) {
            case 'set':
                batch.set(docRef, op.data);
                break;
            case 'update':
                batch.update(docRef, op.data);
                break;
            case 'delete':
                batch.delete(docRef);
                break;
        }

        // Track collections to invalidate
        collectionsToInvalidate.add(op.collection);

        // Update or remove from cache
        if (op.type === 'delete') {
            const cacheKey = CacheKeys.document(op.collection, op.id);
            firestoreCache.delete(cacheKey);
        } else if (op.data) {
            const cacheKey = CacheKeys.document(op.collection, op.id);
            firestoreCache.set(cacheKey, { id: op.id, ...op.data }, CacheTTL.MEDIUM);
        }
    }

    await batch.commit();

    // Invalidate collection caches
    for (const collectionName of collectionsToInvalidate) {
        firestoreCache.invalidateCollection(collectionName);
    }
}

/**
 * Optimistic update with automatic cache update
 */
export async function optimisticUpdate<T extends { id: string }>(
    firestore: Firestore,
    collectionName: string,
    id: string,
    updates: Partial<T>,
    originalData: T
): Promise<void> {
    const docRef = doc(firestore, collectionName, id);
    const cacheKey = CacheKeys.document(collectionName, id);

    // Optimistically update cache
    const updatedData = { ...originalData, ...updates };
    firestoreCache.set(cacheKey, updatedData, CacheTTL.MEDIUM);

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateDoc(docRef, updates as any);
    } catch (error) {
        // Revert cache on error
        firestoreCache.set(cacheKey, originalData, CacheTTL.MEDIUM);
        throw error;
    }
}

/**
 * Create a document with automatic cache update
 */
export async function createDocument<T extends { id?: string }>(
    firestore: Firestore,
    collectionName: string,
    data: T,
    customId?: string
): Promise<string> {
    let docId: string;

    if (customId) {
        const docRef = doc(firestore, collectionName, customId);
        await setDoc(docRef, { ...data, id: customId });
        docId = customId;
    } else {
        const collectionRef = collection(firestore, collectionName);
        const docRef = await addDoc(collectionRef, data);
        docId = docRef.id;
    }

    // Cache the new document
    const cacheKey = CacheKeys.document(collectionName, docId);
    firestoreCache.set(cacheKey, { ...data, id: docId }, CacheTTL.MEDIUM);

    // Invalidate collection cache
    firestoreCache.invalidateCollection(collectionName);

    return docId;
}

/**
 * Delete a document with automatic cache invalidation
 */
export async function deleteDocument(
    firestore: Firestore,
    collectionName: string,
    id: string
): Promise<void> {
    const docRef = doc(firestore, collectionName, id);

    // Remove from cache
    const cacheKey = CacheKeys.document(collectionName, id);
    firestoreCache.delete(cacheKey);

    // Delete from Firestore
    await deleteDoc(docRef);

    // Invalidate collection cache
    firestoreCache.invalidateCollection(collectionName);
}

/**
 * Prefetch related data efficiently
 */
export async function prefetchRelated<T>(
    firestore: Firestore,
    parentCollection: string,
    parentId: string,
    relations: Array<{
        collection: string;
        foreignKey: string;
    }>,
    ttl: number = CacheTTL.MEDIUM
): Promise<void> {
    // Fetch all relations in parallel
    await Promise.all(
        relations.map(async (relation) => {
            const cacheKey = CacheKeys.query(relation.collection, `${relation.foreignKey}=${parentId}`);

            // Skip if already cached
            if (firestoreCache.has(cacheKey)) {
                return;
            }

            const collectionRef = collection(firestore, relation.collection);
            const q = createQuery(collectionRef, where(relation.foreignKey, '==', parentId));
            const snapshot = await getDocs(q);

            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            firestoreCache.set(cacheKey, data, ttl);

            // Also cache individual documents
            data.forEach(item => {
                const docCacheKey = CacheKeys.document(relation.collection, item.id);
                firestoreCache.set(docCacheKey, item, ttl);
            });
        })
    );
}
