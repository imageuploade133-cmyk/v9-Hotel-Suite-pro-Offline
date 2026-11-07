'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useUser } from '@/contexts/user-context';
import type { Branch, UserProfile } from '@/lib/types';
import { PagePermission } from '@/lib/permissions';
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
  activeBranches: Branch[];
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
  activeBranches: [],
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
  const { userProfile, permissions } = useUser();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [pointOfSales, setPointOfSales] = useState<PointOfSale[]>([]);
  const [currentPosId, setCurrentPosId] = useState<string | null>(null);
  const initializedAdminUidRef = useRef<string | null>(null);

  // Active branches (visible only)
  const activeBranches = useMemo(() => {
    return branches.filter(b => b.status !== 'hidden');
  }, [branches]);


  // Explicit staff assignments always take precedence over administrator access.
  const hasExplicitBranchAssignments = Array.isArray(userProfile?.assignedBranches)
    && userProfile.assignedBranches.length > 0;
  const canAccessAllBranches = !hasExplicitBranchAssignments && (
    userProfile?.isFirebaseOnlyAdmin === true
    || userProfile?.isSuperAdmin === true
    || permissions.includes(PagePermission.MANAGE_BRANCHES)
  );

  const branchesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'branches'));
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
    if (!userProfile) {
      // A later login, including the same account, must start from its default branch.
      initializedAdminUidRef.current = null;
      return;
    }
    if (isLoadingBranches) return;

    const savedBranchId = localStorage.getItem('currentBranchId');
    const assignedBranches = Array.isArray(userProfile.assignedBranches)
      ? userProfile.assignedBranches
      : [];

    if (assignedBranches.length > 0) {
      // Keep the existing staff behaviour: restore only a branch explicitly assigned
      // to this staff account, otherwise use the first assigned branch.
      const validSavedBranch = savedBranchId && savedBranchId !== 'global'
        && assignedBranches.includes(savedBranchId);
      const nextBranchId = validSavedBranch ? savedBranchId : assignedBranches[0];
      setCurrentBranchId(nextBranchId);
      localStorage.setItem('currentBranchId', nextBranchId);
      return;
    }

    if (canAccessAllBranches) {
      const adminUid = userProfile.uid || userProfile.id || 'admin';
      // Initialize the administrator's branch once per authenticated app session.
      // Manual branch changes then remain in effect until the next login.
      if (initializedAdminUidRef.current === adminUid) return;
      initializedAdminUidRef.current = adminUid;

      // The project's default branch is the oldest active/visible branch by createdAt.
      // Use a stable ID fallback for legacy branch records without createdAt.
      const defaultBranch = [...activeBranches].sort((a, b) => {
        const getCreatedAt = (branch: Branch) => {
          const value: any = branch.createdAt;
          if (value && typeof value.toMillis === 'function') return value.toMillis();
          if (value instanceof Date) return value.getTime();
          if (typeof value === 'string' || typeof value === 'number') {
            const parsed = new Date(value).getTime();
            return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
          }
          return Number.MAX_SAFE_INTEGER;
        };
        const timeDifference = getCreatedAt(a) - getCreatedAt(b);
        return timeDifference || a.id.localeCompare(b.id);
      })[0];

      // If no active branch exists yet, retain the safe global fallback.
      const nextBranchId = defaultBranch?.id || 'global';
      setCurrentBranchId(nextBranchId);
      localStorage.setItem('currentBranchId', nextBranchId);
      setCurrentPosId(null);
      localStorage.removeItem('currentPosId');
      return;
    }

    // Do not let an unassigned staff member inherit a branch saved by another user.
    setCurrentBranchId(null);
    localStorage.removeItem('currentBranchId');
    setCurrentPosId(null);
    localStorage.removeItem('currentPosId');
  }, [userProfile, canAccessAllBranches, activeBranches, isLoadingBranches]);

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

    const assignedBranches = Array.isArray(userProfile.assignedBranches)
      ? userProfile.assignedBranches
      : [];

    if (branchId === 'global') {
      if (!canAccessAllBranches) {
        console.warn('User does not have permission to access Global Branch');
        return;
      }
      setCurrentBranchId('global');
      localStorage.setItem('currentBranchId', 'global');
      setCurrentPosId(null);
      localStorage.removeItem('currentPosId');
      return;
    }

    if (branchId) {
      const isAssigned = assignedBranches.includes(branchId);
      const isAdminAccessible = canAccessAllBranches
        && activeBranches.some(branch => branch.id === branchId);
      if (!isAssigned && !isAdminAccessible) {
        console.warn('User does not have access to this branch');
        return;
      }
    } else if (assignedBranches.length > 0) {
      return;
    }

    setCurrentBranchId(branchId);
    if (branchId) localStorage.setItem('currentBranchId', branchId);
    else localStorage.removeItem('currentBranchId');
    setCurrentPosId(null);
    localStorage.removeItem('currentPosId');
  }, [userProfile, canAccessAllBranches, activeBranches]);

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

  // Determine which branches the user can access (only active/visible branches)
  const userAccessibleBranches = useMemo(() => {
    if (canAccessAllBranches) return activeBranches;
    const assignedBranches = Array.isArray(userProfile?.assignedBranches)
      ? userProfile.assignedBranches
      : [];
    return activeBranches.filter(branch => assignedBranches.includes(branch.id));
  }, [activeBranches, userProfile?.assignedBranches, canAccessAllBranches]);

  // Non-administrators are restricted to explicitly assigned branches.
  const isRestrictedToBranch = useMemo(() => !canAccessAllBranches, [canAccessAllBranches]);

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
    activeBranches,
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
  }), [branches, activeBranches, currentBranchId, currentBranch, isLoadingBranches, selectBranch, isBranchMode, isGlobalMode, getCollectionPath, userAccessibleBranches, canSwitchBranches, isRestrictedToBranch, pointOfSales, currentPosId, currentPos, selectPos, isPosMode, getPosSelectorVisible]);

  return (
    <BranchContext.Provider value={value}>
      {children}
    </BranchContext.Provider>
  );
};
