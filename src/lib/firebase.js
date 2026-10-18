import { initializeApp } from 'firebase/app';
import {
  getAuth, initializeAuth, inMemoryPersistence, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, getDoc, getDocs,
  setDoc, deleteDoc, onSnapshot, writeBatch,
} from 'firebase/firestore';
import { createFirestoreBackend } from './backends/firestore.js';
import { createFirestoreFileStore } from './backends/firestoreFiles.js';
import { createPeopleApi } from './backends/people.js';
import { setFileStore } from './files.js';
import { todayISO } from './dates.js';

/** The four settings come from the Firebase console. They are not secrets: security comes from the database rules. */
export function startFirebase() {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    // Keeps a copy on the device: the app opens fast, works through a short signal loss, and re-opening
    // only downloads what changed, which keeps the free daily read limit far away.
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  const fs = { collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, writeBatch };

  // Making an account for someone else must not sign the owner out, so it happens in a second, private
  // copy of Firebase that remembers nothing.
  let helper = null;
  const createAccount = async (email, password) => {
    if (!helper) {
      const second = initializeApp(config, 'new-person');
      helper = initializeAuth(second, { persistence: inMemoryPersistence });
    }
    try {
      const made = await createUserWithEmailAndPassword(helper, email, password);
      return made.user.uid;
    } finally {
      await signOut(helper).catch(() => {});
    }
  };

  return {
    onUser: (cb) => onAuthStateChanged(auth, cb),
    signIn: (email, password) => signInWithEmailAndPassword(auth, email.trim(), password),
    resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),
    signOut: () => signOut(auth),
    backendFor: (uid) => {
      setFileStore(createFirestoreFileStore({ db, fs })); // invoice files go online too
      const backend = createFirestoreBackend({ db, fs, uid, today: todayISO() });
      backend.uid = uid;
      backend.people = createPeopleApi({ db, fs, selfUid: uid, createAccount, sendReset: (email) => sendPasswordResetEmail(auth, email) });
      return backend;
    },
  };
}
