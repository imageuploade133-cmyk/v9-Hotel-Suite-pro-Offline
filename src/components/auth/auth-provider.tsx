
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
      if (!user) {
        // router.push('/'); // Redirect to login page on logout
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
    try {
      return await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed' || !navigator.onLine) {
        console.warn('[Offline Auth] Network request failed. Applying persistent offline user session.');
        if (auth.currentUser) {
          setUser(auth.currentUser);
          return auth.currentUser;
        }
        const offlineUser = {
          uid: `offline_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email: email,
          displayName: email.split('@')[0],
          photoURL: null,
          emailVerified: true,
        } as User;
        setUser(offlineUser);
        return { user: offlineUser };
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
