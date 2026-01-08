import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  enableIndexedDbPersistence,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
export { where, orderBy, limit, query, collection };
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  setPersistence,
  browserSessionPersistence,
} from 'firebase/auth';

// ... (imports)

// ... (config)

// Configuration fournie par l'utilisateur
// FALLBACKS ADDED: Vite build seems to struggle with .env injection in this environment.
// Hardcoding safe public values to ensure the app initializes.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB2zMUjWWLodrD0DNKMu2q9lFLWjsbNZGU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'bel-air-habitat.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'bel-air-habitat',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'bel-air-habitat.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '653532514900',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:653532514900:web:e11b20153e7a37decb7bc1',
};

let db: any = null;
let app: any = null;
let storage: any = null;
let auth: any = null;

try {
  app = initializeApp(firebaseConfig);
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  storage = getStorage(app);
  auth = getAuth(app);

  // SECURITY: Force Session Persistence (Logout on Tab Close)
  // This addresses the "Major Security Breach" concern where users remained logged in automatically.
  setPersistence(auth, browserSessionPersistence)
    .then(() => {
      // Persistence set successfully
    })
    .catch((error) => {
      console.warn('Auth Persistence Error:', error);
    });

  // Tentative de persistance hors ligne
  enableIndexedDbPersistence(db).catch((err) => {
    // Silently fail if persistence not supported
  });
} catch (e) {
  console.warn('Firebase Init Error (Offline Mode):', e);
}

export { db, auth, storage };

// --- Fonctions Utilitaires Firestore ---

/**
 * Écoute une collection en temps réel (Lecture)
 * Supports optional query constraints
 */
export const subscribeToCollection = (
  collectionName: string,
  callback: (data: any[]) => void,
  constraints: any[] = []
) => {
  if (!db) {
    console.warn('DB not initialized, skipping subscription');
    return () => {};
  }
  const q = query(collection(db, collectionName), ...constraints);
  return onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      callback(data);
    },
    (error) => {
      console.warn(`[Mode Hors Ligne] Impossible de lire ${collectionName}`, error);
    }
  );
};

/**
 * Sauvegarde ou Met à jour un document (Écriture)
 */
export const saveDocument = async (collectionName: string, docId: string, data: any) => {
  try {
    if (!db) throw new Error('Database not initialized');
    await setDoc(doc(db, collectionName, docId), data, { merge: true });
  } catch (e: any) {
    console.warn(`[Sauvegarde Locale] Synchro Cloud impossible pour ${collectionName}/${docId}`);
    // Logique de retry ou queue locale pourrait être ajoutée ici
  }
};

/**
 * Supprime un document
 */
export const deleteDocument = async (collectionName: string, docId: string) => {
  try {
    if (!db) throw new Error('Database not initialized');
    await deleteDoc(doc(db, collectionName, docId));
  } catch (e: any) {
    console.warn(`[Erreur Suppression] ${collectionName}/${docId}`);
  }
};

// --- Fonctions Utilitaires Storage ---

/**
 * Upload un fichier vers Firebase Storage et retourne l'URL
 * Inclus un Timeout court (5s) pour basculer rapidement en local si le réseau bloque
 */
export const uploadFileToCloud = async (path: string, file: File): Promise<string> => {
  if (!storage) throw new Error('Storage not initialized');

  const performUpload = async (attempt: number): Promise<string> => {
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      if (attempt < 3) {
        console.warn(`Upload attempt ${attempt} failed, retrying...`, error);
        await new Promise((r) => setTimeout(r, 1000 * attempt)); // Exponential backoff-ish
        return performUpload(attempt + 1);
      }
      throw error;
    }
  };

  // Timeout de sécurité global augmenté à 5 minutes (300s) pour les très gros fichiers
  const timeoutPromise = new Promise<string>((_, reject) => {
    setTimeout(() => reject(new Error('Cloud Upload Timed Out (5 min limit)')), 300000);
  });

  try {
    return await Promise.race([performUpload(1), timeoutPromise]);
  } catch (error) {
    console.warn('Storage Upload Issue (will fallback to local if possible):', error);
    throw error;
  }
};

// --- AUTHENTICATION ---
export const signIn = (email: string, password: string) => {
  if (!auth) return Promise.reject('Auth not initialized');
  return signInWithEmailAndPassword(auth, email, password);
};

export const registerUser = (email: string, password: string) => {
  if (!auth) return Promise.reject('Auth not initialized');
  return createUserWithEmailAndPassword(auth, email, password);
};

export const logout = () => {
  if (!auth) return Promise.reject('Auth not initialized');
  return signOut(auth);
};

export const subscribeToAuth = (callback: (user: FirebaseUser | null) => void) => {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
};
