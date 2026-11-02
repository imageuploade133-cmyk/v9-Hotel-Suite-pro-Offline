
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import type { User } from 'firebase/auth';
import type { UserProfile } from '@/lib/types';
import { PERMISSION_GROUPS, ALL_PERMISSIONS, PagePermission, DEFAULT_SYSTEM_ROLES } from '@/lib/permissions';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, onSnapshot, doc, getDocs, getDocsFromServer } from 'firebase/firestore';
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

      const fetchWithTimeout = async <T,>(p: Promise<T>, ms = 1200): Promise<T | null> => {
        try {
          return await Promise.race([
            p,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
          ]);
        } catch {
          return null;
        }
      };

      if (!cachedRoomStatuses) {
        try {
          const snap = await fetchWithTimeout(getDocs(collection(firestore, 'roomStatuses')));
          if (snap && snap.docs) {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            firestoreCache.set(roomStatusesCacheKey, data, CacheTTL.LONG);
            setRoomStatuses(data);
          }
        } catch {}
      }

      if (!cachedUsers) {
        try {
          const snap = await fetchWithTimeout(getDocs(collection(firestore, 'users')));
          if (snap && snap.docs) {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as UserProfile[];
            firestoreCache.set(usersCacheKey, data, CacheTTL.LONG);
            setAllUsers(data);
          }
        } catch {}
      }

      if (!cachedInventorySpaces) {
        try {
          const snap = await fetchWithTimeout(getDocs(collection(firestore, 'inventorySpaces')));
          if (snap && snap.docs) {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            firestoreCache.set(inventorySpacesCacheKey, data, CacheTTL.LONG);
            setInventorySpaces(data);
          }
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

    let isCancelled = false;

    // Set loading while user profile is resolved to prevent granting unauthorized access
    setLoading(true);

    const loadProfile = async () => {
      let matchedProfile: UserProfile | null = null;
      let authoritativeLookupCompleted = false;

      // 1. When internet is available, require a server-confirmed Firestore profile.
      // A successful server lookup with no matching UID must NOT fall through to stale cache.
      if (typeof navigator === 'undefined' || navigator.onLine) {
        try {
          const snap = await getDocsFromServer(collection(firestore, 'users'));
          authoritativeLookupCompleted = true;
          const usersList = snap.docs.map(d => ({ id: d.id, ...d.data() })) as UserProfile[];
          firestoreCache.set(CacheKeys.collection('users'), usersList, CacheTTL.LONG);
          matchedProfile = usersList.find(
            u => u && (u.uid === user.uid || u.id === user.uid)
          ) || null;
        } catch {
          // Cloud unavailable: continue to the local Master PC and offline cache.
        }
      }

      // 2. If cloud authority is unavailable, ask the local Master PC first.
      // A successful LAN response is authoritative for this local network session.
      if (!authoritativeLookupCompleted) {
        let lanLookupCompleted = false;
        try {
          const res = await fetch('/api/lan-sync?collection=users');
          if (res.ok) {
            const result = await res.json();
            if (result && result.success === true && result.data && typeof result.data === 'object') {
              lanLookupCompleted = true;
              const usersList = Object.values(result.data) as UserProfile[];
              matchedProfile = usersList.find(
                u => u && (u.uid === user.uid || u.id === user.uid)
              ) || null;
            }
          }
        } catch (e) {
          console.warn('[LAN Sync] Local profile lookup error:', e);
        }

        // 3. Use previously synced staff profiles only when neither cloud nor LAN can answer.
        // Cached data is never allowed to override a successful authoritative "not assigned" result.
        if (!lanLookupCompleted) {
          const cachedUsers = firestoreCache.get<UserProfile[]>(CacheKeys.collection('users'));
          if (cachedUsers && Array.isArray(cachedUsers)) {
            matchedProfile = cachedUsers.find(
              u => u && (u.uid === user.uid || u.id === user.uid)
            ) || null;
          }
        }
      }

      // Firebase accounts without a matching staff profile remain unassigned.
      if (!isCancelled) {
        setUserProfile(matchedProfile);
        setLoading(false);
      }
    };
    loadProfile();

    // Ensure loading never hangs longer than 800ms when offline or switching Wi-Fi
    const fallbackTimer = setTimeout(() => {
      if (!isCancelled) {
        setLoading(false);
      }
    }, 800);

    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
        // The UID-keyed document is authoritative only when its stored identity agrees.
        if (profileData.uid && profileData.uid !== user.uid) {
          setUserProfile(null);
        } else {
          setUserProfile(profileData);
        }
        setLoading(false);
      } else {
        loadProfile();
      }
    }, (error) => {
      console.warn("Firestore profile snapshot error, checking local LAN store profile:", error);
      loadProfile();
    });

    return () => {
      isCancelled = true;
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [user, authLoading, firestore, refreshTrigger]);

  // Use actual user permissions from their role/profile
  // Automatically resolve permissions for Admins and defined Roles
  const permissions = useMemo(() => {
    // Missing profiles are unassigned accounts: never grant permissions implicitly.
    if (!userProfile) {
      return [];
    }

    // 1. If user is Admin, Super Admin, or has isSuperAdmin flag, grant ALL_PERMISSIONS
    const roleLower = (userProfile.role || '').toLowerCase();
    if (userProfile.isSuperAdmin || roleLower === 'admin' || roleLower === 'super admin' || roleLower.includes('super admin')) {
      return ALL_PERMISSIONS;
    }

    // 2. If explicit permissions array is set on the user's Firestore profile, strictly use it
    if (Array.isArray(userProfile.permissions) && userProfile.permissions.length > 0) {
      return userProfile.permissions;
    }

    // 3. Look up permissions matching the user's assigned role name from system roles
    const matchingRole = DEFAULT_SYSTEM_ROLES.find(
      r => r.name.toLowerCase() === roleLower || r.id.toLowerCase() === roleLower
    );
    if (matchingRole && matchingRole.permissions && matchingRole.permissions.length > 0) {
      return matchingRole.permissions;
    }

    // 4. If user profile has no assigned permissions/role, do NOT grant arbitrary permissions
    return userProfile.permissions || [];
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
