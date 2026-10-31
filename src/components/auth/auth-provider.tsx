
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
      setUser(user);
      setLoading(false);
      if (user && user.email && typeof window !== 'undefined') {
        // Update user profile info in cache without overwriting any stored password hash
        try {
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

      // 1. Fetch staff/user accounts from Local Master Server or local cache
      let usersList: any[] = [];
      try {
        const res = await fetch('/api/lan-sync?collection=users');
        if (res.ok) {
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
      const normalizedEmail = email.trim().toLowerCase();
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

    // Race Firebase cloud auth against a fast 2.5-second timeout so offline / slow Wi-Fi logins respond instantly
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        const timeoutErr = new Error('Auth timeout: cloud servers unreachable on current Wi-Fi');
        (timeoutErr as any).code = 'auth/network-request-failed';
        reject(timeoutErr);
      }, 2500);
    });

    try {
      const res = await Promise.race([
        signInWithEmailAndPassword(auth, email, pass),
        timeoutPromise
      ]);

      // Cache successful login credentials hash/record for verified offline authentication fallback
      if (res && (res as any).user && typeof window !== 'undefined') {
        try {
          const u = (res as any).user;
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
        } catch {}
      }

      return res;
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed' || (err.message && err.message.includes('timeout'))) {
        return await performOfflineAuth();
      }
      throw err;
    }
  };

  const logout = async () => {
    if (!auth) {
      console.error("Auth not initialized");
      return;
    }
    try {
      console.log("Logging out...");
      await signOut(auth);
      console.log("Logout successful");
    } catch (error) {
      console.error("Error logging out:", error);
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
