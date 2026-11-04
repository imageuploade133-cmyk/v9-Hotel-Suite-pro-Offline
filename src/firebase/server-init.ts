import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyOfflineMasterServerDefaultApiKey123",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "hotel-suite-pro-offline.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "hotel-suite-pro-offline",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "hotel-suite-pro-offline.appspot.com",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789012:web:offline123456789012",
};

let app: FirebaseApp;
let firestore: Firestore;

if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

firestore = getFirestore(app);

export { app, firestore };
