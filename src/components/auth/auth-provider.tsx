
'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useMemo,
} from 'react';
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  Auth,
} from 'firebase/auth';
import { useFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { isLocalMasterHost } from '@/lib/lan-sync/is-local-master-host';

type AuthContextType = {
  user: User | null;
  auth: Auth | null;
  loading: boolean;
  login: (email: string, pass: string, remember: boolean) => Promise<any>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { auth, isInitialized } = useFirebase();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) {
        setLoading(true);
        return;
    }

    if (!auth) {
        // Firebase is not configured, so we are not in an authenticated state.
        setUser(null);
        setLoading(false);
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        setLoading(false);
        if (user.email && typeof window !== 'undefined') {
          try {
            localStorage.setItem('app_active_offline_session', JSON.stringify({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              emailVerified: true,
            }));

            const authCache = JSON.parse(localStorage.getItem('app_auth_credentials_cache') || '{}');
            const existing = authCache[user.email.toLowerCase()] || {};
            authCache[user.email.toLowerCase()] = {
              ...existing,
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              lastAuthenticated: Date.now(),
            };
            localStorage.setItem('app_auth_credentials_cache', JSON.stringify(authCache));
          } catch {}
        }
      } else {
        // When offline or cloud unreachable, restore active offline session so hard reloads don't log out
        let offlineSession = null;
        if (typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem('app_active_offline_session');
            if (raw) offlineSession = JSON.parse(raw);
          } catch {}
        }
        setUser(offlineSession);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth, router, isInitialized]);

  const login = async (email: string, pass: string, remember: boolean) => {
    if (!isInitialized) {
      return Promise.reject(new Error("Authentication is not ready yet. Please try again in a moment."));
    }
    if (!auth) {
      return Promise.reject(new Error("Firebase is not configured. Please check your environment variables."));
    }

    const performOfflineAuth = async () => {
      console.warn('[Offline Auth] Network offline or cloud unreachable. Verifying credentials against local Master PC store...');

      const normalizedEmail = email.trim().toLowerCase();

      // 1. First attempt centralized Master Server offline login endpoint
      try {
        const offRes = await fetch('/api/auth/offline-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, password: pass }),
        });
        if (offRes.ok) {
          const offData = await offRes.json();
          if (offData.success && offData.user) {
            const u = offData.user;
            const offlineUid = u.uid || `offline_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const offlineUser = {
              uid: offlineUid,
              email: u.email || email,
              displayName: u.name || email.split('@')[0],
              photoURL: u.photoURL || null,
              emailVerified: true,
            } as User;

            setUser(offlineUser);
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('app_active_offline_session', JSON.stringify(offlineUser));
                // The Master Server response includes the cached role and permissions.
                // Save them locally before the protected layout starts resolving access.
                if (u.role || Array.isArray(u.permissions)) {
                  const staffProfile = {
                    id: offlineUid,
                    uid: offlineUid,
                    email: u.email || email,
                    name: u.name || email.split('@')[0],
                    role: u.role || 'Staff',
                    permissions: Array.isArray(u.permissions) ? u.permissions : [],
                    assignedBranches: Array.isArray(u.assignedBranches) ? u.assignedBranches : [],
                    isActive: u.isActive !== false,
                  };
                  const existingUsers = JSON.parse(localStorage.getItem('app_cached_staff_users') || '[]');
                  const users = Array.isArray(existingUsers) ? existingUsers.filter((item: any) =>
                    item && item.uid !== offlineUid && item.id !== offlineUid &&
                    item.email?.toLowerCase() !== staffProfile.email.toLowerCase()
                  ) : [];
                  users.push(staffProfile);
                  localStorage.setItem('app_cached_staff_users', JSON.stringify(users));
                  localStorage.setItem(`app_account_type_${offlineUid}`, 'staff');
                }
              } catch {}
            }
            return { user: offlineUser };
          }
        }
      } catch (err) {
        console.warn('[Offline Auth] Master PC offline auth endpoint not reached, falling back to local cache:', err);
      }

      // 2. Fallback: Fetch staff/user accounts from Local Master Server or local cache
      let usersList: any[] = [];
      try {
        const res = isLocalMasterHost() ? await fetch('/api/lan-sync?collection=users') : null;
        if (res?.ok) {
          const result = await res.json();
          if (result.data) {
            usersList = Object.values(result.data);
          }
        }
      } catch (err) {
        console.warn('[Offline Auth] Could not query LAN users list:', err);
      }

      // Check local storage cached users if LAN list was empty
      if (usersList.length === 0 && typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('app_cached_staff_users');
          if (cached) usersList = JSON.parse(cached);
        } catch {}
      }

      // 2. Find user matching email
      const matchedUser = usersList.find(
        (u) => u && (u.email?.toLowerCase() === normalizedEmail || u.id === normalizedEmail)
      );

      // 3. Check previously authenticated credentials cache
      let cachedAuthUser: any = null;
      if (typeof window !== 'undefined') {
        try {
          const authCache = JSON.parse(localStorage.getItem('app_auth_credentials_cache') || '{}');
          cachedAuthUser = authCache[normalizedEmail];
        } catch {}
      }

      // If user is registered in local staff system:
      if (matchedUser) {
        // Enforce active user check: Disallow disabled accounts from logging in!
        if (matchedUser.isActive === false) {
          const inactiveErr: any = new Error('Your account has been disabled. Please contact an administrator.');
          inactiveErr.code = 'auth/user-disabled';
          throw inactiveErr;
        }

        // Verify password against recorded local credentials or previous auth cache
        const registeredPassword = matchedUser.pendingPasswordSync || matchedUser.password || matchedUser.pin;
        let passwordMatches = false;

        if (registeredPassword) {
          passwordMatches = registeredPassword === pass;
        } else if (cachedAuthUser && cachedAuthUser.passHash) {
          passwordMatches = cachedAuthUser.passHash === btoa(pass);
        } else {
          // If no password recorded locally or cached from previous login, reject for security
          passwordMatches = false;
        }

        if (!passwordMatches) {
          const credErr: any = new Error('Invalid email or password.');
          credErr.code = 'auth/wrong-password';
          throw credErr;
        }

        const offlineUser = {
          uid: matchedUser.uid || matchedUser.id || `offline_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email: matchedUser.email || email,
          displayName: matchedUser.name || email.split('@')[0],
          photoURL: matchedUser.photoURL || null,
          emailVerified: true,
        } as User;

        setUser(offlineUser);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('app_active_offline_session', JSON.stringify(offlineUser));
          } catch {}
        }
        return { user: offlineUser };
      }

      // If user was previously authenticated on this device (e.g. Firebase Admin user)
      if (cachedAuthUser) {
        // Enforce verified password check: if passHash is missing or mismatch, reject login
        const passHash = cachedAuthUser.passHash;
        const inputHash = btoa(pass);
        if (!passHash || passHash !== inputHash) {
          const credErr: any = new Error('Invalid email or password.');
          credErr.code = 'auth/wrong-password';
          throw credErr;
        }

        const offlineUser = {
          uid: cachedAuthUser.uid || `offline_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email: cachedAuthUser.email || email,
          displayName: cachedAuthUser.displayName || email.split('@')[0],
          photoURL: cachedAuthUser.photoURL || null,
          emailVerified: true,
        } as User;

        setUser(offlineUser);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('app_active_offline_session', JSON.stringify(offlineUser));
          } catch {}
        }
        return { user: offlineUser };
      }

      // Disallow unauthorized login with invalid credentials offline
      const notFoundErr: any = new Error('Invalid email or password.');
      notFoundErr.code = 'auth/user-not-found';
      throw notFoundErr;
    };

    // If client is marked offline, fall back instantly to verified offline auth
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return await performOfflineAuth();
    }

    // Race Firebase cloud auth against a fast 2.5-second timeout so offline / slow Wi-Fi logins respond instantly.
    // Clear the timer when Firebase responds; the auth state listener is a second
    // source of truth, but a successful sign-in must not wait for that listener
    // before the app can leave its redirect screen.
    let authTimeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        authTimeoutId = setTimeout(() => {
          const timeoutErr = new Error('Auth timeout: cloud servers unreachable on current Wi-Fi');
          (timeoutErr as any).code = 'auth/network-request-failed';
          reject(timeoutErr);
        }, 2500);
      });

      const res = await Promise.race([
        signInWithEmailAndPassword(auth, email, pass),
        timeoutPromise
      ]);

      if (authTimeoutId) clearTimeout(authTimeoutId);

      // Update the provider immediately from the successful Firebase credential.
      // Do not depend solely on onAuthStateChanged: its initial callback can be
      // delayed while navigation is already waiting for an authenticated user.
      const authenticatedUser = (res as any)?.user as User | undefined;
      if (authenticatedUser) {
        setUser(authenticatedUser);
        setLoading(false);
      }

      // Cache successful login credentials hash/record for verified offline authentication fallback
      if (authenticatedUser && typeof window !== 'undefined') {
        try {
          const u = authenticatedUser;
          const authCache = JSON.parse(localStorage.getItem('app_auth_credentials_cache') || '{}');
          authCache[email.trim().toLowerCase()] = {
            uid: u.uid,
            email: u.email || email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            // Simple credential verification record
            passHash: btoa(pass),
            lastAuthenticated: Date.now(),
          };
          localStorage.setItem('app_auth_credentials_cache', JSON.stringify(authCache));

          // Also register with Master PC so other devices on local Wi-Fi can log in offline
          fetch('/api/auth/offline-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'cache_user',
              user: {
                uid: u.uid,
                email: u.email || email,
                name: u.displayName || (email ? email.split('@')[0] : 'Staff'),
                photoURL: u.photoURL || null,
              },
              password: pass,
            }),
          }).catch(() => {});
        } catch {}
      }

      return res;
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed' || (err.message && err.message.includes('timeout'))) {
        return await performOfflineAuth();
      }
      throw err;
    } finally {
      if (authTimeoutId) clearTimeout(authTimeoutId);
    }
  };

  const logout = async () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('app_active_offline_session');
      } catch {}
    }
    if (!auth) {
      setUser(null);
      return;
    }
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Error logging out:", error);
      setUser(null);
    }
  };

  const sendPasswordReset = (email: string) => {
    if (!auth) return Promise.reject(new Error("Auth not initialized"));
    return sendPasswordResetEmail(auth, email);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      sendPasswordReset,
      auth,
    }),
    [user, loading, login, logout, sendPasswordReset, auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
