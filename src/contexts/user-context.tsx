
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import type { User } from 'firebase/auth';
import type { UserProfile } from '@/lib/types';
import { PERMISSION_GROUPS, ALL_PERMISSIONS, DEFAULT_SYSTEM_ROLES } from '@/lib/permissions';
import { useFirestore } from '@/firebase';
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
const toFirebaseAdminProfile = (
  user: User,
  accountProfile?: Partial<UserProfile> | null
): UserProfile => ({
  id: user.uid,
  uid: user.uid,
  name: accountProfile?.name || user.displayName || user.email?.split('@')[0] || 'Admin',
  email: user.email || accountProfile?.email || '',
  role: 'Admin',
  photoURL: accountProfile?.photoURL || user.photoURL || undefined,
  phoneNumber: accountProfile?.phoneNumber ?? null,
  permissions: ALL_PERMISSIONS,
  isActive: true,
  isSuperAdmin: false,
  isFirebaseOnlyAdmin: true,
  assignedBranches: [],
  ...(accountProfile?.uiPreferences ? { uiPreferences: accountProfile.uiPreferences } : {}),
});

const toStaffProfile = (user: User, profile: Partial<UserProfile>): UserProfile => {
  const roleName = profile.role || 'Staff';
  const defaultRolePermissions = DEFAULT_SYSTEM_ROLES.find(role => role.name === roleName)?.permissions || [];

  return {
    ...profile,
    id: profile.id || user.uid,
    uid: user.uid,
    name: profile.name || user.displayName || user.email?.split('@')[0] || 'Staff',
    email: profile.email || user.email || '',
    role: roleName,
    // An explicitly stored empty array means this role has no permissions.
    // Only legacy records with no permissions field use the built-in role defaults.
    permissions: Array.isArray(profile.permissions)
      ? profile.permissions.filter((permission): permission is string => typeof permission === 'string')
      : defaultRolePermissions,
    isActive: profile.isActive !== false,
    isSuperAdmin: profile.isSuperAdmin === true,
    isFirebaseOnlyAdmin: false,
  };
};

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

const hasStaffAssignment = (profile: Partial<UserProfile> | null | undefined): boolean => {
  if (!profile || profile.isFirebaseOnlyAdmin === true ||
      (profile as any).accountType === 'firebase-only-admin') {
    return false;
  }

  const normalizedRole = typeof profile.role === 'string' ? profile.role.trim().toLowerCase() : '';
  const hasExplicitRole = normalizedRole.length > 0 && normalizedRole !== 'no-role';
  const hasExplicitPermissions = Array.isArray(profile.permissions) &&
    profile.permissions.some(permission => typeof permission === 'string' && permission.trim().length > 0);
  const roleId = (profile as any).roleId;
  const hasRoleId = typeof roleId === 'string' && roleId.trim().length > 0 && roleId !== 'no-role';

  // A personal profile written by the Profile page contains fields such as
  // name/photoURL only. It is not a staff assignment and must not remove Admin access.
  return hasExplicitRole || hasExplicitPermissions || hasRoleId || profile.isActive === false;
};

const findMatchingProfile = (
  users: unknown,
  uid: string,
  email?: string | null
): Partial<UserProfile> | null => {
  if (!Array.isArray(users)) return null;
  const lowerEmail = email?.trim().toLowerCase();
  const matches = (users as Partial<UserProfile>[]).filter(profile =>
    profile && (
      profile.uid === uid ||
      profile.id === uid ||
      (!!lowerEmail && profile.email?.trim().toLowerCase() === lowerEmail)
    )
  );

  // Prefer a real role assignment if a cache contains more than one identity match.
  return matches.find(hasStaffAssignment) || matches[0] || null;
};

const findStaffProfile = (users: unknown, uid: string, email?: string | null): UserProfile | null => {
  const profile = findMatchingProfile(users, uid, email);
  return profile && hasStaffAssignment(profile) ? profile as UserProfile : null;
};

const readCachedAccountProfile = (uid: string): Partial<UserProfile> | null => {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem('app_cached_account_profile_' + uid);
    return value ? JSON.parse(value) as Partial<UserProfile> : null;
  } catch {
    return null;
  }
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
        isFirebaseOnlyAdmin: false,
        accountType: 'staff',
      },
    }),
  }).catch(() => {});
};

const cacheFirebaseOnlyAdminForOffline = (
  user: User,
  accountProfile?: Partial<UserProfile> | null
) => {
  setCachedAccountType(user.uid, 'firebase-only-admin');

  if (typeof window === 'undefined') return;

  const cachedProfile = {
    id: user.uid,
    uid: user.uid,
    name: accountProfile?.name || user.displayName || user.email?.split('@')[0] || 'Admin',
    email: user.email || accountProfile?.email || '',
    photoURL: accountProfile?.photoURL || user.photoURL || undefined,
    role: 'Admin',
    permissions: ALL_PERMISSIONS,
    isActive: true,
    isFirebaseOnlyAdmin: true,
  };

  try {
    localStorage.setItem('app_cached_account_profile_' + user.uid, JSON.stringify(cachedProfile));

    // Remove any older staff assignment for this identity. A removed role must
    // not survive in the local roster and reappear as stale permissions offline.
    const cachedUsers = readCachedStaffUsers().filter(profile =>
      profile && profile.uid !== user.uid && profile.id !== user.uid &&
      profile.email?.trim().toLowerCase() !== user.email?.trim().toLowerCase()
    );
    localStorage.setItem('app_cached_staff_users', JSON.stringify(cachedUsers));
    firestoreCache.set(CacheKeys.collection('users'), cachedUsers, CacheTTL.LONG);
  } catch {
    // Local storage may be unavailable; the authenticated session can still continue.
  }

  // Keep the Master PC's offline credential record in sync with the verified account type.
  if (isLocalMasterHost()) {
    void fetch('/api/auth/offline-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cache_user',
        user: {
          uid: user.uid,
          email: user.email || '',
          name: cachedProfile.name,
          role: 'Admin',
          permissions: ALL_PERMISSIONS,
          assignedBranches: [],
          isFirebaseOnlyAdmin: true,
          accountType: 'firebase-only-admin',
        },
      }),
    }).catch(() => {});
  }
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
    let lookupInProgress = false;

    const cachedUsers = readCachedStaffUsers();
    const cachedAccountProfile =
      findMatchingProfile(cachedUsers, user.uid, user.email) || readCachedAccountProfile(user.uid);
    const cachedStaff = findStaffProfile(cachedUsers, user.uid, user.email);
    const cachedAccountType = getCachedAccountType(user.uid);
    const hasCachedFirebaseAdmin = cachedAccountType === 'firebase-only-admin' ||
      (!!cachedAccountProfile && !hasStaffAssignment(cachedAccountProfile));

    const applyStaffProfile = (profile: UserProfile) => {
      if (isCancelled) return;
      setCachedAccountType(user.uid, 'staff');
      const normalizedProfile = toStaffProfile(user, profile);
      setUserProfile(normalizedProfile);
      setLoading(false);
      cacheStaffProfile(normalizedProfile);
      syncStaffProfileToMaster(normalizedProfile);
    };

    const applyFirebaseAdmin = (profile?: Partial<UserProfile> | null) => {
      if (isCancelled) return;
      const normalizedProfile = toFirebaseAdminProfile(user, profile);
      cacheFirebaseOnlyAdminForOffline(user, profile);
      setUserProfile(normalizedProfile);
      setLoading(false);
    };

    const applyUnverifiedProfile = () => {
      if (isCancelled) return;
      setUserProfile(toUnverifiedProfile(user));
      setLoading(false);
    };

    // Reuse the last verified identity immediately. The server lookup below runs
    // in the background and replaces this provisional profile if the assignment changed.
    if (cachedStaff) {
      applyStaffProfile(cachedStaff);
    } else if (hasCachedFirebaseAdmin) {
      applyFirebaseAdmin(cachedAccountProfile);
    } else {
      setUserProfile(null);
      setLoading(true);
    }

    if (!firestore) {
      if (!cachedStaff && !hasCachedFirebaseAdmin) applyUnverifiedProfile();
      return;
    }

    const isDeviceOnline = typeof navigator === 'undefined' || navigator.onLine;
    if (!isDeviceOnline) {
      if (!cachedStaff && !hasCachedFirebaseAdmin) applyUnverifiedProfile();
      return;
    }

    const withTimeout = <T,>(
      promise: Promise<T>,
      milliseconds: number,
      message: string
    ): Promise<T> => new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error(message)), milliseconds);
      promise.then(
        value => {
          clearTimeout(timeoutId);
          resolve(value);
        },
        error => {
          clearTimeout(timeoutId);
          reject(error);
        }
      );
    });

    const resolveProfile = async () => {
      if (lookupInProgress || isCancelled) return;
      lookupInProgress = true;

      let accountProfile: Partial<UserProfile> | null = null;
      let matchedStaffProfile: UserProfile | null = null;
      let lookupSucceeded = false;

      try {
        // On the local Master host, its local roster is the fastest source of truth.
        if (isLocalMasterHost()) {
          const controller = new AbortController();
          try {
            const response = await withTimeout(
              fetch('/api/lan-sync/?collection=users', {
                signal: controller.signal,
                cache: 'no-store',
              }),
              850,
              'Local staff roster lookup timed out'
            );

            if (response.ok) {
              const result = await response.json();
              if (result?.success === true && result.data && typeof result.data === 'object') {
                const usersList = Object.entries(result.data).map(([id, value]) => ({
                  id,
                  ...(value && typeof value === 'object' ? value : {}),
                })) as UserProfile[];

                firestoreCache.set(CacheKeys.collection('users'), usersList, CacheTTL.LONG);
                try {
                  localStorage.setItem('app_cached_staff_users', JSON.stringify(usersList));
                } catch {}

                accountProfile = findMatchingProfile(usersList, user.uid, user.email);
                matchedStaffProfile = findStaffProfile(usersList, user.uid, user.email);
                if (accountProfile) lookupSucceeded = true;
              }
            }
          } catch {
            controller.abort();
            // Continue with the direct Firestore identity lookup.
          }
        }

        // Staff records are normally stored under the Firebase UID. Check that
        // document first so the common case needs only one server read.
        if (!accountProfile && !matchedStaffProfile) {
          let uidDocumentFound = false;
          try {
            const uidDocument = await withTimeout(
              getDocFromServer(doc(firestore, 'users', user.uid)),
              2200,
              'Firestore UID profile lookup timed out'
            );

            if (uidDocument.exists()) {
              const uidProfile = {
                id: uidDocument.id,
                ...uidDocument.data(),
              } as UserProfile;

              if (uidProfile.uid && uidProfile.uid !== user.uid) {
                throw new Error('The profile UID does not match the authenticated account.');
              }

              accountProfile = uidProfile;
              matchedStaffProfile = hasStaffAssignment(uidProfile) ? uidProfile : null;
              uidDocumentFound = true;
              lookupSucceeded = true;
            }
          } catch (error) {
            if (error instanceof Error &&
                error.message === 'The profile UID does not match the authenticated account.') {
              throw error;
            }
            // If the UID document is absent or temporarily unavailable, try legacy identities below.
          }

          // Older staff records may have a custom document ID. Query by UID/email
          // only when the canonical UID document was not found.
          if (!uidDocumentFound) {
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

            const matchingStaff = await withTimeout(
              getDocsFromServer(query(collection(firestore, 'users'), or(...staffFilters))),
              2600,
              'Firestore staff identity lookup timed out'
            );
            const matches = matchingStaff.docs.map(staffDocument => ({
              id: staffDocument.id,
              ...staffDocument.data(),
            } as UserProfile));

            accountProfile = findMatchingProfile(matches, user.uid, user.email);
            matchedStaffProfile = findStaffProfile(matches, user.uid, user.email);
            lookupSucceeded = true;
          }
        }
        if (isCancelled) return;

        if (matchedStaffProfile) {
          applyStaffProfile(matchedStaffProfile);
        } else if (lookupSucceeded) {
          setCachedAccountType(user.uid, 'firebase-only-admin');
          applyFirebaseAdmin(accountProfile || cachedAccountProfile);
        } else if (cachedStaff) {
          // Preserve the last verified staff assignment if the cloud is temporarily unreachable.
          applyStaffProfile(cachedStaff);
        } else if (hasCachedFirebaseAdmin) {
          applyFirebaseAdmin(cachedAccountProfile);
        } else {
          applyUnverifiedProfile();
        }
      } catch {
        if (isCancelled) return;

        // Network failures must not silently turn an unknown account into Admin.
        // Only a previously verified cached identity may be used as the fallback.
        if (cachedStaff) {
          applyStaffProfile(cachedStaff);
        } else if (hasCachedFirebaseAdmin) {
          applyFirebaseAdmin(cachedAccountProfile);
        } else {
          applyUnverifiedProfile();
        }
      } finally {
        lookupInProgress = false;
      }
    };

    void resolveProfile();

    // Watch the UID document for permission/role changes. Personal profile-only
    // documents are not staff assignments; resolveProfile checks legacy IDs too.
    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.metadata.fromCache && (typeof navigator === 'undefined' || navigator.onLine)) {
        return;
      }

      if (docSnap.exists()) {
        const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
        if (profileData.uid && profileData.uid !== user.uid) {
          applyUnverifiedProfile();
          return;
        }

        if (hasStaffAssignment(profileData)) {
          applyStaffProfile(profileData);
        } else {
          void resolveProfile();
        }
      } else {
        void resolveProfile();
      }
    }, () => {
      // The bounded identity lookup above remains the source of truth if the listener fails.
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [user, authLoading, firestore, refreshTrigger]);

  // Firebase-only accounts and explicitly flagged super-admins are unrestricted.
  // Every ordinary Firestore staff profile follows its stored permission assignment,
  // even when its display role happens to be named "Admin".
  const permissions = useMemo(() => {
    if (!user || !userProfile || userProfile.isActive === false) return [];

    const dynamicPermissions = dynamicPermissionGroups.flatMap(group =>
      (group.permissions || []).map((permission: any) => permission.id)
    );
    const isUnrestrictedAdmin = userProfile.isFirebaseOnlyAdmin === true || userProfile.isSuperAdmin === true;
    const assignedPermissions = isUnrestrictedAdmin
      ? [...ALL_PERMISSIONS, ...dynamicPermissions]
      : (Array.isArray(userProfile.permissions) ? userProfile.permissions : []);

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
