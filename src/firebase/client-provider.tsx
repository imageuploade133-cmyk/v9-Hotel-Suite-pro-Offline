
'use client';

import React, { createContext, useEffect, useState, useMemo } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isFirebaseConfigured =
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId;

interface FirebaseContextValue {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  isInitialized: boolean;
}

const FirebaseContext = createContext<FirebaseContextValue>({
  app: null,
  auth: null,
  firestore: null,
  isInitialized: false,
});

export const FirebaseClientProvider = ({ children }: { children: React.ReactNode }) => {
  const [app, setApp] = useState<FirebaseApp | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [firestore, setFirestore] = useState<Firestore | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsInitialized(true);
      return;
    }

    try {
      if (isFirebaseConfigured) {
        const apps = getApps();
        const initializedApp = apps.length ? apps[0] : initializeApp(firebaseConfig);
        setApp(initializedApp);
        setAuth(getAuth(initializedApp));
        let dbInstance: Firestore;
        try {
          dbInstance = initializeFirestore(initializedApp, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
          });
        } catch {
          dbInstance = getFirestore(initializedApp);
        }
        setFirestore(dbInstance);
      } else {
        console.warn("Firebase configuration is incomplete. Firebase services will be disabled.");
      }
    } catch (error) {
      console.error("Firebase initialization failed:", error);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Memoize the context value to prevent infinite re-render loops
  const contextValue = useMemo<FirebaseContextValue>(
    () => ({ app, auth, firestore, isInitialized }),
    [app, auth, firestore, isInitialized]
  );

  return (
    <FirebaseContext.Provider value={contextValue}>
      {children}
    </FirebaseContext.Provider>
  );
};

FirebaseClientProvider.Context = FirebaseContext;
