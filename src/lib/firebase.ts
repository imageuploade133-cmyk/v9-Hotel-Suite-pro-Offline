import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId
);

// Track whether Firebase has been successfully initialized
let firebaseInitialized = false;
let firebaseInitError: Error | null = null;

// Check if we're on the server (during build or SSR)
const isServer = typeof window === 'undefined';

let app: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

function initializeFirebase(): FirebaseApp | null {
  // Skip if already initialized
  if (firebaseInitialized && app) {
    return app;
  }

  if (!isFirebaseConfigured) {
    if (!isServer) {
      console.warn('Firebase is not configured. Please set up your Firebase environment variables.');
    }
    return null;
  }

  if (!app) {
    try {
      app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      firebaseInitialized = true;
    } catch (error) {
      console.warn('Failed to initialize Firebase:', error);
      firebaseInitError = error as Error;
      return null;
    }
  }
  return app;
}

export function getDb(): Firestore | null {
  // Skip initialization during server-side build entirely
  // This prevents build failures when Firebase is not properly configured
  if (isServer) {
    return null;
  }

  try {
    const firebaseApp = initializeFirebase();
    if (!firebaseApp) {
      return null;
    }

    if (!dbInstance) {
      try {
        dbInstance = initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        });
      } catch {
        dbInstance = getFirestore(firebaseApp);
      }
    }
    return dbInstance;
  } catch (error) {
    console.warn('Failed to get Firestore instance:', error);
    return null;
  }
}

export function getFirebaseAuth(): Auth | null {
  // Skip initialization during server-side build entirely
  // This prevents build failures when Firebase is not properly configured
  if (isServer) {
    return null;
  }

  try {
    const firebaseApp = initializeFirebase();
    if (!firebaseApp) {
      return null;
    }

    if (!authInstance) {
      authInstance = getAuth(firebaseApp);
    }
    return authInstance;
  } catch (error) {
    console.warn('Failed to get Auth instance:', error);
    return null;
  }
}

// Export a check function for components to use
export function isConfigured(): boolean {
  return isFirebaseConfigured && !firebaseInitError;
}

// For backward compatibility: export db and auth
// These will be null during server build to prevent build errors
// Components should handle the case where these are null
export let db: Firestore | null = null;
export let auth: Auth | null = null;

// Initialize lazily only on client-side
// Never initialize on server during build to prevent build failures
if (typeof window !== 'undefined') {
  // Client-side: initialize
  try {
    db = getDb();
    auth = getFirebaseAuth();
  } catch (e) {
    console.warn('Firebase initialization failed on client:', e);
  }
}
// On server (during build/SSR), leave db and auth as null
// This prevents build failures when Firebase is not properly configured
