
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import type { User } from 'firebase/auth';
import type { UserProfile } from '@/lib/types';
import { PERMISSION_GROUPS, ALL_PERMISSIONS, PagePermission } from '@/lib/permissions';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, onSnapshot, doc, getDocs } from 'firebase/firestore';
import { sanitizeForUrl } from '@/lib/helpers';
import { firestoreCache, CacheTTL, CacheKeys } from '@/lib/firestore-cache';

interface UserContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  permissions: string[];
  loading: boolean;
  dynamicPermissionGroups: any[];
  refreshUserProfile: () => void;
  userMap: Map<string, UserProfile>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  userProfile: null,
  permissions: [],
  loading: true,
  dynamicPermissionGroups: PERMISSION_GROUPS,
  refreshUserProfile: () => {},
  userMap: new Map(),
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const firestore = useFirestore();

  const [roomStatuses, setRoomStatuses] = React.useState<any[]>(() => {
    const cached = firestoreCache.get<any[]>(CacheKeys.collection('roomStatuses'));
    return cached || [];
  });
  const [allUsers, setAllUsers] = React.useState<UserProfile[]>(() => {
    const cached = firestoreCache.get<UserProfile[]>(CacheKeys.collection('users'));
    return cached || [];
  });
  const [inventorySpaces, setInventorySpaces] = React.useState<any[]>(() => {
    const cached = firestoreCache.get<any[]>(CacheKeys.collection('inventorySpaces'));
    return cached || [];
  });

  useEffect(() => {
    if (!firestore) return;

    const fetchAuxData = async () => {
      const roomStatusesCacheKey = CacheKeys.collection('roomStatuses');
      const usersCacheKey = CacheKeys.collection('users');
      const inventorySpacesCacheKey = CacheKeys.collection('inventorySpaces');

      const cachedRoomStatuses = firestoreCache.get<any[]>(roomStatusesCacheKey);
      const cachedUsers = firestoreCache.get<UserProfile[]>(usersCacheKey);
      const cachedInventorySpaces = firestoreCache.get<any[]>(inventorySpacesCacheKey);

      if (!cachedRoomStatuses) {
        try {
          const snap = await getDocs(collection(firestore, 'roomStatuses'));
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          firestoreCache.set(roomStatusesCacheKey, data, CacheTTL.LONG);
          setRoomStatuses(data);
        } catch {}
      }

      if (!cachedUsers) {
        try {
          const snap = await getDocs(collection(firestore, 'users'));
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as UserProfile[];
          firestoreCache.set(usersCacheKey, data, CacheTTL.LONG);
          setAllUsers(data);
        } catch {}
      }

      if (!cachedInventorySpaces) {
        try {
          const snap = await getDocs(collection(firestore, 'inventorySpaces'));
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          firestoreCache.set(inventorySpacesCacheKey, data, CacheTTL.LONG);
          setInventorySpaces(data);
        } catch {}
      }
    };

    const timeoutId = setTimeout(fetchAuxData, 500);

    const unsubRS = onSnapshot(collection(firestore, 'roomStatuses'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      firestoreCache.set(CacheKeys.collection('roomStatuses'), data, CacheTTL.LONG);
      setRoomStatuses(data);
    }, () => {});

    const unsubIS = onSnapshot(collection(firestore, 'inventorySpaces'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      firestoreCache.set(CacheKeys.collection('inventorySpaces'), data, CacheTTL.LONG);
      setInventorySpaces(data);
    }, () => {});

    const unsubUsers = onSnapshot(collection(firestore, 'users'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as UserProfile[];
      firestoreCache.set(CacheKeys.collection('users'), data, CacheTTL.LONG);
      setAllUsers(data);
    }, () => {});

    return () => {
      clearTimeout(timeoutId);
      unsubRS();
      unsubIS();
      unsubUsers();
    };
  }, [firestore]);

  const userMap = useMemo(() => {
    if (!allUsers || allUsers.length === 0) return new Map<string, UserProfile>();
    return new Map(allUsers.map(u => [u.uid, u]));
  }, [allUsers]);

  const dynamicPermissionGroups = useMemo(() => {
    const baseGroups = PERMISSION_GROUPS;

    const customStatusPermissions = (roomStatuses || [])
      .filter(status => status && status.showInSidebar && status.name)
      .map(status => {
        const permissionId = `view:${sanitizeForUrl(status.name)}`;
        return {
          id: permissionId as any,
          description: `Can view the page for "${status.name}" status`,
        };
      });

    const inventoryPermissions = (inventorySpaces || [])
      .filter(space => space && space.isActive && space.id && space.name)
      .flatMap(space => [
        {
          id: `view:inventory:${space.id}` as any,
          description: `View the "${space.name}" inventory and its stock`,
        },
        {
          id: `pos:inventory:${space.id}` as any,
          description: `Access the POS for "${space.name}" inventory`,
        },
        {
          id: `sales:inventory:${space.id}` as any,
          description: `View sales history for "${space.name}" inventory`,
        },
        {
          id: `customers:inventory:${space.id}` as any,
          description: `Manage customers for "${space.name}" inventory`,
        },
        {
          id: `alerts:inventory:${space.id}` as any,
          description: `View stock alerts for "${space.name}" inventory`,
        },
      ]);

    const newGroups = baseGroups.map(group => ({ ...group, permissions: [...group.permissions] }));

    const customStatusIndex = newGroups.findIndex(g => g.id === 'custom_statuses');
    if (customStatusIndex !== -1) {
      newGroups[customStatusIndex] = { ...newGroups[customStatusIndex], permissions: customStatusPermissions as any };
    } else {
      newGroups.push({ id: 'custom_statuses', name: 'Custom Room Statuses', permissions: customStatusPermissions as any });
    }

    if (inventoryPermissions.length > 0) {
      const invGroupIndex = newGroups.findIndex(g => g.id === 'inventory_spaces_dynamic');
      if (invGroupIndex !== -1) {
        newGroups[invGroupIndex] = { ...newGroups[invGroupIndex], permissions: inventoryPermissions as any };
      } else {
        newGroups.push({ id: 'inventory_spaces_dynamic', name: 'Inventory Spaces (Per-Space Access)', permissions: inventoryPermissions as any });
      }
    }

    return newGroups;
  }, [roomStatuses, inventorySpaces]);

  const refreshUserProfile = React.useCallback(() => {
    setRefreshTrigger(count => count + 1);
  }, []);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user || !firestore) {
      setUserProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
        setUserProfile(profileData);
      } else {
        console.warn(`No Firestore profile found for user ${user.uid}. Creating temporary profile with full access.`);
        // Create a temporary profile for users without a staff profile
        // This allows them to access pages that require authentication
        const temporaryProfile: UserProfile = {
          id: user.uid,
          uid: user.uid,
          name: user.displayName || 'Unnamed User',
          email: user.email || '',
          role: 'Staff',
          photoURL: user.photoURL || undefined,
          permissions: ALL_PERMISSIONS,
          isActive: true,
          assignedBranches: [],
        };
        setUserProfile(temporaryProfile);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching user profile:", error);
      // When there's an error (e.g., permission denied due to security rules),
      // create a temporary profile so the user can still access the application.
      // This handles cases where the user is authenticated but doesn't have
      // a staff profile in Firestore due to permission issues or missing data.
      const temporaryProfile: UserProfile = {
        id: user.uid,
        uid: user.uid,
        name: user.displayName || 'Unnamed User',
        email: user.email || '',
        role: 'Staff',
        photoURL: user.photoURL || undefined,
        permissions: ALL_PERMISSIONS,
        isActive: true,
        assignedBranches: [],
      };
      setUserProfile(temporaryProfile);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, firestore, refreshTrigger]);

  // Use actual user permissions from their role/profile
  // Falls back to MANAGE_OWN_PROFILE if no permissions are set
  const permissions = useMemo(() => {
    if (userProfile?.permissions && userProfile.permissions.length > 0) {
      return userProfile.permissions;
    }
    // Fallback: allow at least profile access
    return [PagePermission.MANAGE_OWN_PROFILE];
  }, [userProfile]);

  const value = useMemo(
    () => ({
      user,
      userProfile,
      permissions,
      loading,
      dynamicPermissionGroups,
      refreshUserProfile,
      userMap,
    }),
    [user, userProfile, permissions, loading, dynamicPermissionGroups, refreshUserProfile, userMap]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
