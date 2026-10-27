'use client';

import { useMemo } from 'react';
import { useBranch } from '@/contexts/branch-context';
import { query, where, Query, CollectionReference } from 'firebase/firestore';

/**
 * Hook that provides branch-aware query utilities
 * When in branch mode, all queries will be filtered by branchId
 */
export function useBranchQuery() {
  const { currentBranchId, isBranchMode } = useBranch();

  /**
   * Creates a branch-aware query that filters by branchId
   * Returns the original query when not in branch mode
   */
  const branchQuery = useMemo(() => {
    return <T>(
      collectionRef: CollectionReference<T> | Query<T>,
      fieldPath: string,
      branchFieldName: string = 'branchId'
    ): Query<T> | CollectionReference<T> => {
      if (!isBranchMode || !currentBranchId) {
        return collectionRef;
      }

      // If it's already a Query, add the where clause
      if ('type' in collectionRef && collectionRef.type === 'query') {
        return query(collectionRef as Query<T>, where(branchFieldName, '==', currentBranchId));
      }

      // If it's a CollectionReference, create a new query with where clause
      return query(collectionRef, where(branchFieldName, '==', currentBranchId));
    };
  }, [currentBranchId, isBranchMode]);

  /**
   * Check if a record belongs to the current branch
   */
  const isInCurrentBranch = useMemo(() => {
    return (record: { branchId?: string | null }): boolean => {
      if (!isBranchMode) return true;
      return record.branchId === currentBranchId;
    };
  }, [currentBranchId, isBranchMode]);

  /**
   * Filter an array of records by current branch
   */
  const filterByBranch = useMemo(() => {
    return <T extends { branchId?: string | null }>(records: T[]): T[] => {
      if (!isBranchMode) return records;
      return records.filter(record => record.branchId === currentBranchId);
    };
  }, [currentBranchId, isBranchMode]);

  return {
    branchQuery,
    isInCurrentBranch,
    filterByBranch,
    currentBranchId,
    isBranchMode,
  };
}
