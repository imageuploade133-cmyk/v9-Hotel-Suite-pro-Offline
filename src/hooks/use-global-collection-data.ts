'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, getDocs, query as fbQuery, QueryConstraint, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useBranch, BRANCH_ISOLATED_COLLECTIONS, POS_ISOLATED_COLLECTIONS, type PointOfSale } from '@/contexts/branch-context';

/**
 * Hook for querying branch-isolated collections across all branches in global mode only.
 * This hook is ONLY used when isGlobalMode is true.
 * For branch mode, use useCollection directly from Firebase.
 *
 * In global mode, it aggregates data from:
 * 1. The root-level collection (data created when no branch was selected)
 * 2. All branch-specific sub-collections (branches/{id}/{collectionName})
 * 3. All POS-specific sub-collections if the collection is POS-isolated
 *
 * Each document gets an `id` field (matching useCollection behavior) plus
 * branchId / posId tags so callers can tell where data originated.
 *
 * @param collectionName - Name of the collection to query
 * @param constraints - Optional Firestore query constraints (must be a stable reference)
 * @returns { data, isLoading, error }
 */
export function useGlobalCollectionData<T extends Record<string, any> = any>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
) {
  const firestore = useFirestore();
  const { branches, isGlobalMode, userAccessibleBranches } = useBranch();
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Stable constraint key -- avoids the infinite-loop caused by a new [] on every render
  const constraintsKey = useMemo(
    () => JSON.stringify(constraints.map(c => String(c))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [constraints.length]
  );

  // Keep a ref so the snapshot callbacks always see the latest constraints without
  // needing them in the effect deps (which would re-subscribe on every render).
  const constraintsRef = useRef(constraints);
  constraintsRef.current = constraints;

  // Determine which branches to query
  const branchesToQuery = useMemo(() => {
    return userAccessibleBranches.length > 0 ? userAccessibleBranches : branches;
  }, [userAccessibleBranches, branches]);

  // Stable key so the effect only re-runs when the *set* of branches changes
  const branchesKey = useMemo(
    () => branchesToQuery.map(b => b.id).sort().join(','),
    [branchesToQuery]
  );

  useEffect(() => {
    // Guard: only run in global mode for branch-isolated collections
    if (!firestore || !isGlobalMode || !BRANCH_ISOLATED_COLLECTIONS.includes(collectionName)) {
      setData([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const unsubscribers: (() => void)[] = [];
    // Map keyed by "source-docId" to deduplicate across sources
    const dataMap = new Map<string, T>();

    const flush = () => {
      if (!isMounted) return;
      const merged = Array.from(dataMap.values());
      setData(merged);
      setError(null);
      setIsLoading(false);
    };

    const setupListeners = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Root-level collection (data created in global mode)
        try {
          const rootQuery = fbQuery(
            collection(firestore, collectionName),
            ...constraintsRef.current
          );

          const unsubRoot = onSnapshot(
            rootQuery,
            (snapshot) => {
              // Remove stale root entries then re-add current ones
              for (const key of dataMap.keys()) {
                if (key.startsWith('root-')) dataMap.delete(key);
              }
              snapshot.forEach(d => {
                dataMap.set(`root-${d.id}`, { id: d.id, ...d.data() } as T);
              });
              flush();
            },
            (err) => {
              console.warn(`Error listening to root-level ${collectionName}:`, err);
            }
          );
          unsubscribers.push(unsubRoot);
        } catch (err) {
          console.warn(`Could not setup listener for root-level ${collectionName}:`, err);
        }

        // 2. Branch + POS collections
        if (branchesToQuery.length > 0) {
          // Pre-fetch POS terminals for each branch (one-time)
          const allPos = new Map<string, PointOfSale[]>();

          await Promise.all(
            branchesToQuery.map(async (branch) => {
              try {
                const posDocs = await getDocs(
                  collection(firestore, `branches/${branch.id}/pointOfSales`)
                );
                const posList: PointOfSale[] = [];
                posDocs.forEach(d => posList.push({ id: d.id, ...d.data() } as PointOfSale));
                if (posList.length > 0) allPos.set(branch.id, posList);
              } catch {
                // Ignore -- branch may not have POS sub-collection
              }
            })
          );

          for (const branch of branchesToQuery) {
            // Branch-level listener
            try {
              const branchQuery = fbQuery(
                collection(firestore, `branches/${branch.id}/${collectionName}`),
                ...constraintsRef.current
              );

              const prefix = `${branch.id}-`;
              const unsubBranch = onSnapshot(
                branchQuery,
                (snapshot) => {
                  // Clear old entries for this branch (non-POS)
                  for (const key of dataMap.keys()) {
                    if (key.startsWith(prefix) && key.split('-').length === 2) dataMap.delete(key);
                  }
                  snapshot.forEach(d => {
                    const docData = { id: d.id, ...d.data() } as T;
                    if (!docData.branchId) (docData as any).branchId = branch.id;
                    dataMap.set(`${branch.id}-${d.id}`, docData);
                  });
                  flush();
                },
                (err) => {
                  console.warn(`Error listening to ${branch.id}/${collectionName}:`, err);
                }
              );
              unsubscribers.push(unsubBranch);
            } catch {
              // Ignore
            }

            // POS-level listeners (only for POS-isolated collections)
            if (POS_ISOLATED_COLLECTIONS.includes(collectionName)) {
              const posList = allPos.get(branch.id) || [];
              for (const pos of posList) {
                try {
                  const posQuery = fbQuery(
                    collection(firestore, `branches/${branch.id}/pointOfSales/${pos.id}/${collectionName}`),
                    ...constraintsRef.current
                  );

                  const posPrefix = `${branch.id}-${pos.id}-`;
                  const unsubPos = onSnapshot(
                    posQuery,
                    (snapshot) => {
                      for (const key of dataMap.keys()) {
                        if (key.startsWith(posPrefix)) dataMap.delete(key);
                      }
                      snapshot.forEach(d => {
                        const docData = { id: d.id, ...d.data() } as T;
                        if (!docData.branchId) (docData as any).branchId = branch.id;
                        if (!(docData as any).posId) (docData as any).posId = pos.id;
                        dataMap.set(`${branch.id}-${pos.id}-${d.id}`, docData);
                      });
                      flush();
                    },
                    (err) => {
                      console.warn(`Error listening to ${branch.id}/${pos.id}/${collectionName}:`, err);
                    }
                  );
                  unsubscribers.push(unsubPos);
                } catch {
                  // Ignore
                }
              }
            }
          }
        }

        // If no branches exist, the root listener is the only source -- flush
        // once to clear the loading state even if the root snapshot hasn't fired yet.
        if (branchesToQuery.length === 0) {
          // The root onSnapshot will call flush(); just ensure loading ends
          setTimeout(() => { if (isMounted && data.length === 0) flush(); }, 500);
        }
      } catch (err) {
        if (isMounted) {
          const e = err instanceof Error ? err : new Error('Failed to setup global collection listeners');
          setError(e);
          setData([]);
          setIsLoading(false);
        }
      }
    };

    setupListeners();

    return () => {
      isMounted = false;
      unsubscribers.forEach(u => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, isGlobalMode, collectionName, branchesKey, constraintsKey]);

  return { data, isLoading, error };
}
