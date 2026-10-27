'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useUser } from '@/contexts/user-context';
import type { Branch, UserProfile } from '@/lib/types';
import {
  BRANCH_ISOLATED_COLLECTIONS,
  POS_ISOLATED_COLLECTIONS,
  type PointOfSale,
} from './branch-types';

export { BRANCH_ISOLATED_COLLECTIONS, POS_ISOLATED_COLLECTIONS };
export type { PointOfSale };

export type BranchContextType = BranchContextValue;

export interface BranchContextValue {
  branches: Branch[];
  currentBranchId: string | null;
  currentBranch: Branch | null;
  isLoadingBranches: boolean;
  selectBranch: (branchId: string | null) => void;
  isBranchMode: boolean;
  isGlobalMode: boolean; // True when viewing data from all branches
  getCollectionPath: (collectionName: string) => string;
  userAccessibleBranches: Branch[]; // Only branches user has access to
  canSwitchBranches: boolean; // Whether user can switch branches
  isRestrictedToBranch: boolean; // Whether user is restricted to specific branch(es)
  // POS-level properties
  pointOfSales: PointOfSale[];
  currentPosId: string | null;
  currentPos: PointOfSale | null;
  selectPos: (posId: string | null) => void;
  isPosMode: boolean; // True when in POS-specific data view
  getPosSelectorVisible: () => boolean; // Whether to show POS selector in UI
}

const BranchContext = createContext<BranchContextValue>({
  branches: [],
  currentBranchId: null,
  currentBranch: null,
  isLoadingBranches: true,
  selectBranch: () => {},
  isBranchMode: false,
  isGlobalMode: false,
  getCollectionPath: (name) => name,
  userAccessibleBranches: [],
  canSwitchBranches: true,
  isRestrictedToBranch: false,
  pointOfSales: [],
  currentPosId: null,
  currentPos: null,
  selectPos: () => {},
  isPosMode: false,
  getPosSelectorVisible: () => false,
});

export const useBranch = () => useContext(BranchContext);

export const BranchProvider = ({ children }: { children: React.ReactNode }) => {
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [pointOfSales, setPointOfSales] = useState<PointOfSale[]>([]);
  const [currentPosId, setCurrentPosId] = useState<string | null>(null);

  const branchesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'branches'), where('status', '==', 'active'));
  }, [firestore]);

  const posQuery = useMemo(() => {
    if (!firestore || !currentBranchId || currentBranchId === 'global') return null;
    return query(
      collection(firestore, `branches/${currentBranchId}/pointOfSales`),
      where('status', '==', 'active')
    );
  }, [firestore, currentBranchId]);

  useCollection<Branch>(branchesQuery, {
    onData: (data) => {
      setBranches(data);
      setIsLoadingBranches(false);
    },
    onError: () => {
      setIsLoadingBranches(false);
    }
  });

  useCollection<PointOfSale>(posQuery, {
    onData: (data) => {
      setPointOfSales(data);
    },
  });

  useEffect(() => {
    if (!userProfile) return;

    const savedBranchId = localStorage.getItem('currentBranchId');
    const isBranchRestricted = userProfile?.assignedBranches && userProfile.assignedBranches.length > 0;

    if (isBranchRestricted) {
      // Branch-restricted user: never allow global, must use an assigned branch
      const assignedBranches = userProfile!.assignedBranches!;
      if (savedBranchId && savedBranchId !== 'global' && assignedBranches.includes(savedBranchId)) {
        // Saved branch is valid and accessible
        setCurrentBranchId(savedBranchId);
      } else {
        // Default to the first assigned branch
        const defaultBranch = assignedBranches[0];
        setCurrentBranchId(defaultBranch);
        localStorage.setItem('currentBranchId', defaultBranch);
      }
    } else {
      // Admin/unrestricted user: can use global and all branches
      if (savedBranchId) {
        setCurrentBranchId(savedBranchId);
      } else {
        setCurrentBranchId('global');
        localStorage.setItem('currentBranchId', 'global');
      }
    }
  }, [userProfile]);

  // Load saved POS selection
  useEffect(() => {
    const savedPosId = localStorage.getItem('currentPosId');
    if (currentBranchId && currentBranchId !== 'global') {
      if (savedPosId && pointOfSales.some(pos => pos.id === savedPosId)) {
        setCurrentPosId(savedPosId);
      } else if (pointOfSales.length > 0) {
        // Default to first POS if no saved selection
        setCurrentPosId(pointOfSales[0].id);
        localStorage.setItem('currentPosId', pointOfSales[0].id);
      } else {
        setCurrentPosId(null);
      }
    } else {
      // In global mode, clear POS selection
      setCurrentPosId(null);
      localStorage.removeItem('currentPosId');
    }
  }, [pointOfSales, currentBranchId]);

  const selectBranch = useCallback((branchId: string | null) => {
    if (!userProfile) return;

    const isBranchRestricted = userProfile?.assignedBranches && userProfile.assignedBranches.length > 0;

    // Block global mode for branch-restricted users
    if (branchId === 'global') {
      if (isBranchRestricted) {
        console.warn('Branch-restricted user cannot access global mode');
        return;
      }
      setCurrentBranchId('global');
      localStorage.setItem('currentBranchId', 'global');
      setCurrentPosId(null);
      localStorage.removeItem('currentPosId');
      return;
    }

    // If user is restricted to specific branches, only allow selecting those
    if (isBranchRestricted) {
      if (branchId && !userProfile!.assignedBranches!.includes(branchId)) {
        console.warn('User does not have access to this branch');
        return;
      }
    }

    setCurrentBranchId(branchId);
    if (branchId) {
      localStorage.setItem('currentBranchId', branchId);
    } else {
      localStorage.removeItem('currentBranchId');
    }
    // Clear POS selection when branch changes
    setCurrentPosId(null);
    localStorage.removeItem('currentPosId');
  }, [userProfile]);

  const selectPos = useCallback((posId: string | null) => {
    if (!posId) {
      setCurrentPosId(null);
      localStorage.removeItem('currentPosId');
      return;
    }

    // Verify POS exists and is in current branch
    if (!pointOfSales.some(pos => pos.id === posId && pos.branchId === currentBranchId)) {
      console.warn('POS not found or not in current branch');
      return;
    }

    setCurrentPosId(posId);
    localStorage.setItem('currentPosId', posId);
  }, [pointOfSales, currentBranchId]);

  const currentBranch = useMemo(() => {
    if (!currentBranchId || branches.length === 0) return null;
    if (currentBranchId === 'global') {
      return { id: 'global', name: 'Global Branch' } as Branch;
    }
    return branches.find(b => b.id === currentBranchId) || null;
  }, [currentBranchId, branches]);

  const isBranchMode = useMemo(() => {
    return currentBranchId !== null && currentBranchId !== 'global';
  }, [currentBranchId]);

  const isGlobalMode = useMemo(() => {
    return currentBranchId === 'global';
  }, [currentBranchId]);

  // Determine which branches the user can access
  const userAccessibleBranches = useMemo(() => {
    if (!userProfile?.assignedBranches || userProfile.assignedBranches.length === 0) {
      // Admin can access all branches
      return branches;
    }
    // User can only access assigned branches
    return branches.filter(b => userProfile.assignedBranches!.includes(b.id));
  }, [branches, userProfile]);

  // Check if user is restricted to specific branches
  const isRestrictedToBranch = useMemo(() => {
    return userProfile?.assignedBranches && userProfile.assignedBranches.length > 0;
  }, [userProfile]);

  // Can user switch branches?
  const canSwitchBranches = useMemo(() => {
    // Users can only switch if they have access to multiple branches
    return userAccessibleBranches.length > 1;
  }, [userAccessibleBranches]);

  const isPosMode = useMemo(() => {
    return isBranchMode && currentPosId !== null && pointOfSales.some(pos => pos.id === currentPosId);
  }, [isBranchMode, currentPosId, pointOfSales]);

  const getCollectionPath = useCallback((collectionName: string): string => {
    // First priority: POS-specific collections in POS mode
    if (isPosMode && currentBranchId && currentPosId && POS_ISOLATED_COLLECTIONS.includes(collectionName)) {
      return `branches/${currentBranchId}/pointOfSales/${currentPosId}/${collectionName}`;
    }
    // Second priority: Branch-specific collections in branch mode
    if (isBranchMode && currentBranchId && currentBranchId !== 'global' && BRANCH_ISOLATED_COLLECTIONS.includes(collectionName)) {
      return `branches/${currentBranchId}/${collectionName}`;
    }
    // Third priority: Root-level collections in global mode or for non-isolated collections
    return collectionName;
  }, [currentBranchId, isBranchMode, isPosMode, currentPosId]);

  const getPosSelectorVisible = useCallback((): boolean => {
    return isBranchMode && pointOfSales.length > 0;
  }, [isBranchMode, pointOfSales]);

  const currentPos = useMemo(() => {
    if (!currentPosId) return null;
    return pointOfSales.find(pos => pos.id === currentPosId) || null;
  }, [currentPosId, pointOfSales]);

  const value = useMemo(() => ({
    branches,
    currentBranchId,
    currentBranch,
    isLoadingBranches,
    selectBranch,
    isBranchMode,
    isGlobalMode,
    getCollectionPath,
    userAccessibleBranches,
    canSwitchBranches,
    isRestrictedToBranch,
    pointOfSales,
    currentPosId,
    currentPos,
    selectPos,
    isPosMode,
    getPosSelectorVisible,
  }), [branches, currentBranchId, currentBranch, isLoadingBranches, selectBranch, isBranchMode, isGlobalMode, getCollectionPath, userAccessibleBranches, canSwitchBranches, isRestrictedToBranch, pointOfSales, currentPosId, currentPos, selectPos, isPosMode, getPosSelectorVisible]);

  return (
    <BranchContext.Provider value={value}>
      {children}
    </BranchContext.Provider>
  );
};
