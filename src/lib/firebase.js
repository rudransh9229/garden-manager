import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, getDoc, getDocs, onSnapshot, writeBatch,
} from 'firebase/firestore';
import { createFirestoreBackend } from './backends/firestore.js';
import { createFirestoreFileStore } from './backends/firestoreFiles.js';
import { setFileStore } from './files.js';
import { todayISO } from './dates.js';

/** The four settings come from the Firebase console. They are not secrets: security comes from the database rules. */
export function startFirebase() {
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    // Keeps a copy on the device: the app opens fast, works through a short signal loss, and re-opening
    // only downloads what changed, which keeps the free daily read limit far away.
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  const fs = { collection, doc, getDoc, getDocs, onSnapshot, writeBatch };
  return {
    onUser: (cb) => onAuthStateChanged(auth, cb),
    signIn: (email, password) => signInWithEmailAndPassword(auth, email.trim(), password),
    resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),
    signOut: () => signOut(auth),
    backendFor: (uid) => {
      setFileStore(createFirestoreFileStore({ db, fs })); // invoice files go online too
      return createFirestoreBackend({ db, fs, uid, today: todayISO() });
    },
  };
}
