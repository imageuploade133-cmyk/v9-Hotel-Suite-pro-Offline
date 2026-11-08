
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import type { User } from 'firebase/auth';
import type { UserProfile } from '@/lib/types';
import { PERMISSION_GROUPS, ALL_PERMISSIONS, PagePermission, DEFAULT_SYSTEM_ROLES } from '@/lib/permissions';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, onSnapshot, doc, getDocs, getDocsFromServer, getDocFromServer, where, or } from 'firebase/firestore';
import { sanitizeForUrl } from '@/lib/helpers';
import { firestoreCache, CacheTTL, CacheKeys } from '@/lib/firestore-cache';
import { isLocalMasterHost } from '@/lib/lan-sync/is-local-master-host';

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

// Firebase-only accounts receive full Admin access. A matching Firestore staff
// record always takes precedence and retains only its explicitly assigned access.
const toFirebaseAdminProfile = (user: User): UserProfile => ({
  id: user.uid,
  uid: user.uid,
  name: user.displayName || user.email?.split('@')[0] || 'Admin',
  email: user.email || '',
  role: 'Admin',
  permissions: ALL_PERMISSIONS,
  isActive: true,
  isSuperAdmin: true,
  isFirebaseOnlyAdmin: true,
  assignedBranches: [],
});

const toStaffProfile = (user: User, profile: Partial<UserProfile>): UserProfile => ({
  ...profile,
  id: profile.id || user.uid,
  uid: user.uid,
  name: profile.name || user.displayName || user.email?.split('@')[0] || 'Staff',
  email: profile.email || user.email || '',
  role: profile.role || 'Staff',
  permissions: Array.isArray(profile.permissions)
    ? profile.permissions.filter((permission): permission is string => typeof permission === 'string')
    : [],
  isActive: profile.isActive !== false,
  isSuperAdmin: profile.isSuperAdmin === true,
  isFirebaseOnlyAdmin: false,
});

const accountTypeCacheKey = (uid: string) => `app_account_type_${uid}`;

const getCachedAccountType = (uid: string): 'staff' | 'firebase-only-admin' | null => {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(accountTypeCacheKey(uid));
    return value === 'staff' || value === 'firebase-only-admin' ? value : null;
  } catch {
    return null;
  }
};

const setCachedAccountType = (uid: string, value: 'staff' | 'firebase-only-admin') => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(accountTypeCacheKey(uid), value);
  } catch {
    // Browser storage may be unavailable; online resolution remains authoritative.
  }
};

const toUnverifiedProfile = (user: User): UserProfile => ({
  id: user.uid,
  uid: user.uid,
  name: user.displayName || user.email?.split('@')[0] || 'User',
  email: user.email || '',
  role: 'Access not verified',
  permissions: [],
  isActive: true,
  isSuperAdmin: false,
  isFirebaseOnlyAdmin: false,
});

const readCachedStaffUsers = (): UserProfile[] => {
  const cached = firestoreCache.get<UserProfile[]>(CacheKeys.collection('users'));
  if (Array.isArray(cached) && cached.length > 0) return cached;

  if (typeof window !== 'undefined') {
    try {
      const localUsers = JSON.parse(localStorage.getItem('app_cached_staff_users') || '[]');
      if (Array.isArray(localUsers)) return localUsers as UserProfile[];
    } catch {
      // Ignore malformed local cache and continue with an empty roster.
    }
  }
  return Array.isArray(cached) ? cached : [];
};

const findStaffProfile = (users: unknown, uid: string, email?: string | null): UserProfile | null => {
  if (!Array.isArray(users)) return null;
  const lowerEmail = email?.toLowerCase();
  return (users as UserProfile[]).find(profile =>
    profile && (
      profile.uid === uid ||
      profile.id === uid ||
      (lowerEmail && profile.email?.toLowerCase() === lowerEmail)
    )
  ) || null;
};

const cacheStaffProfile = (profile: UserProfile) => {
  if (typeof window === 'undefined') return;
  try {
    const current = readCachedStaffUsers();
    const identity = profile.uid || profile.id;
    const next = current.filter(item =>
      item && item.uid !== identity && item.id !== identity &&
      item.email?.toLowerCase() !== profile.email?.toLowerCase()
    );
    next.push(profile);
    localStorage.setItem('app_cached_staff_users', JSON.stringify(next));
    firestoreCache.set(CacheKeys.collection('users'), next, CacheTTL.LONG);
  } catch {
    // Storage failures must never block authentication.
  }
};

const syncStaffProfileToMaster = (profile: UserProfile) => {
  if (typeof window === 'undefined' || !isLocalMasterHost()) return;
  void fetch('/api/auth/offline-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'cache_user',
      user: {
        uid: profile.uid || profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        permissions: profile.permissions || [],
        assignedBranches: profile.assignedBranches || [],
      },
    }),
  }).catch(() => {});
};

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

      const isDeviceOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      const fetchWithTimeout = async <T,>(p: Promise<T>, ms = 1200): Promise<T | null> => {
        if (isDeviceOffline) return null;
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

    if (!user) {
      setUserProfile(null);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    setUserProfile(null);
    setLoading(true);

    // If Firestore has not initialized, use the device's last synced staff roster
    // before treating this authenticated identity as a Firebase-only Admin.
    if (!firestore) {
      const cachedStaff = findStaffProfile(readCachedStaffUsers(), user.uid, user.email);
      const accountType = getCachedAccountType(user.uid);
      if (cachedStaff) {
        setCachedAccountType(user.uid, 'staff');
        setUserProfile(toStaffProfile(user, cachedStaff));
      } else {
        setUserProfile(accountType === 'firebase-only-admin' ? toFirebaseAdminProfile(user) : toUnverifiedProfile(user));
      }
      setLoading(false);
      return;
    }

    const isDeviceOnline = typeof navigator === 'undefined' || navigator.onLine;
    const cachedStaff = findStaffProfile(readCachedStaffUsers(), user.uid, user.email);
    const cachedAccountType = getCachedAccountType(user.uid);

    if (!isDeviceOnline) {
      if (cachedStaff) {
        setUserProfile(toStaffProfile(user, cachedStaff));
      } else if (cachedAccountType === 'firebase-only-admin') {
        setUserProfile(toFirebaseAdminProfile(user));
      } else {
        setUserProfile(toUnverifiedProfile(user));
      }
      setLoading(false);
      return;
    }


    let profileLookupStarted = false;
    let profileFallbackTimer: ReturnType<typeof setTimeout> | undefined;
    const loadProfile = async () => {
      if (profileLookupStarted) return;
      profileLookupStarted = true;

      let matchedProfile: UserProfile | null = null;
      let cloudLookupCompleted = false;

      // Prefer the local Master roster on LAN installs. iPhone can report online
      // while the internet is unavailable but the hotel Wi-Fi server is reachable.
      if (isLocalMasterHost()) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 650);
        try {
          const response = await fetch('/api/lan-sync/?collection=users', {
            signal: controller.signal,
            cache: 'no-store',
          });
          if (response.ok) {
            const result = await response.json();
            if (result?.success === true && result.data && typeof result.data === 'object') {
              const usersList = Object.entries(result.data).map(([id, value]) => ({
                id,
                ...(value && typeof value === 'object' ? value : {}),
              })) as UserProfile[];
              if (usersList.length > 0) {
                firestoreCache.set(CacheKeys.collection('users'), usersList, CacheTTL.LONG);
                try {
                  localStorage.setItem('app_cached_staff_users', JSON.stringify(usersList));
                } catch {}
                matchedProfile = findStaffProfile(usersList, user.uid, user.email);
                cloudLookupCompleted = true;
              }
            }
          }
        } catch {
          // Continue to the device cache and cloud lookup.
        } finally {
          clearTimeout(timeoutId);
        }
      }

      if (!matchedProfile && cachedStaff) matchedProfile = cachedStaff;

      // For cloud deployments or unresolved local identities, fetch the UID doc
      // and identity query concurrently. Avoid an extra full-roster collection read.
      if (!matchedProfile || !isLocalMasterHost()) {
        let lookupTimeout: ReturnType<typeof setTimeout> | undefined;
        try {
          // Most staff profiles use the Firebase UID as their document ID.
          // Resolve that common case with one lightweight document read first;
          // only perform a collection query for legacy email/custom-ID records.
          const uidDocument = await Promise.race([
            getDocFromServer(doc(firestore, 'users', user.uid)),
            new Promise<never>((_, reject) => {
              lookupTimeout = setTimeout(
                () => reject(new Error('Firestore staff lookup timed out')),
                2000
              );
            }),
          ]);

          const uidProfile = uidDocument.exists()
            ? ({ id: uidDocument.id, ...uidDocument.data() } as UserProfile)
            : null;
          const uidDocumentMatchesIdentity = !!uidProfile &&
            (!uidProfile.uid || uidProfile.uid === user.uid);

          if (uidDocumentMatchesIdentity) {
            matchedProfile = findStaffProfile([uidProfile], user.uid, user.email);
            cloudLookupCompleted = true;
          } else {
            const staffFilters = [
              where('uid', '==', user.uid),
              where('id', '==', user.uid),
            ];
            const exactEmail = user.email?.trim();
            const normalizedEmail = exactEmail?.toLowerCase();
            if (exactEmail) staffFilters.push(where('email', '==', exactEmail));
            if (normalizedEmail && normalizedEmail !== exactEmail) {
              staffFilters.push(where('email', '==', normalizedEmail));
            }

            // Legacy staff profiles may use a custom document ID. Bound this
            // fallback query as well as the UID lookup above so a stalled
            // Firestore request can never leave the login screen loading forever.
            if (lookupTimeout) clearTimeout(lookupTimeout);
            const matchingStaff = await Promise.race([
              getDocsFromServer(query(
                collection(firestore, 'users'),
                or(...staffFilters)
              )),
              new Promise<never>((_, reject) => {
                lookupTimeout = setTimeout(
                  () => reject(new Error('Firestore staff identity lookup timed out')),
                  3000
                );
              }),
            ]);
            const matches = matchingStaff.docs.map(staffDocument => ({
              id: staffDocument.id,
              ...staffDocument.data(),
            } as UserProfile));
            matchedProfile = findStaffProfile(matches, user.uid, user.email);
            cloudLookupCompleted = true;
          }

          setCachedAccountType(user.uid, matchedProfile ? 'staff' : 'firebase-only-admin');
        } catch {
          // Retain the last verified assignment if cloud access is unavailable.
        } finally {
          if (lookupTimeout) clearTimeout(lookupTimeout);
        }
      }

      if (!isCancelled) {
        if (profileFallbackTimer) clearTimeout(profileFallbackTimer);
        if (matchedProfile) {
          setCachedAccountType(user.uid, 'staff');
          const normalizedProfile = toStaffProfile(user, matchedProfile);
          setUserProfile(normalizedProfile);
          cacheStaffProfile(normalizedProfile);
          syncStaffProfileToMaster(normalizedProfile);
        } else if (cloudLookupCompleted || cachedAccountType === 'firebase-only-admin') {
          if (cloudLookupCompleted) setCachedAccountType(user.uid, 'firebase-only-admin');
          setUserProfile(toFirebaseAdminProfile(user));
        } else {
          setUserProfile(toUnverifiedProfile(user));
        }
        setLoading(false);
      }
    };

    // Safety net: never keep a successfully authenticated user on an
    // indefinite redirect screen if Firestore/LAN profile resolution stalls.
    // Only use a previously verified cached identity; otherwise fail closed.
    profileFallbackTimer = setTimeout(() => {
      if (isCancelled) return;
      const lastKnownStaff = findStaffProfile(readCachedStaffUsers(), user.uid, user.email);
      if (lastKnownStaff) {
        setUserProfile(toStaffProfile(user, lastKnownStaff));
      } else if (cachedAccountType === 'firebase-only-admin') {
        setUserProfile(toFirebaseAdminProfile(user));
      } else {
        setUserProfile(toUnverifiedProfile(user));
      }
      setLoading(false);
    }, 8000);

    void loadProfile();

    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      // Do not accept a cached snapshot while online before server confirmation.
      if (docSnap.metadata.fromCache && (typeof navigator === 'undefined' || navigator.onLine)) {
        return;
      }

      if (docSnap.exists()) {
        const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
        if (!profileData.uid || profileData.uid === user.uid) {
          setCachedAccountType(user.uid, 'staff');
          const normalizedProfile = toStaffProfile(user, profileData);
          setUserProfile(normalizedProfile);
          cacheStaffProfile(normalizedProfile);
          syncStaffProfileToMaster(normalizedProfile);
        } else {
          // A document with a mismatched UID is not this user's staff assignment.
          setUserProfile(toUnverifiedProfile(user));
        }
        setLoading(false);
      } else {
        void loadProfile();
      }
    }, () => {
      void loadProfile();
    });

    return () => {
      isCancelled = true;
      if (profileFallbackTimer) clearTimeout(profileFallbackTimer);
      unsubscribe();
    };
  }, [user, authLoading, firestore, refreshTrigger]);

  // Firebase-only accounts get full access; staff accounts get only their Firestore assignment.
  const permissions = useMemo(() => {
    if (!user || !userProfile || userProfile.isActive === false) return [];

    const dynamicPermissions = dynamicPermissionGroups.flatMap(group =>
      (group.permissions || []).map((permission: any) => permission.id)
    );
    const isAdminRole = userProfile.isFirebaseOnlyAdmin || userProfile.role === 'Admin' || userProfile.role === 'Super Admin';
    const assignedPermissions = isAdminRole
      ? [...ALL_PERMISSIONS, ...dynamicPermissions]
      : (Array.isArray(userProfile.permissions) && userProfile.permissions.length > 0
          ? userProfile.permissions
          : (DEFAULT_SYSTEM_ROLES.find(r => r.name === userProfile.role)?.permissions || []));

    return Array.from(new Set(assignedPermissions.filter(permission => typeof permission === 'string')));
  }, [user, userProfile, dynamicPermissionGroups]);

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
