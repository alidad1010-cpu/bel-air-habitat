import { initializeApp, type FirebaseApp } from 'firebase/app';
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
  type Firestore,
} from 'firebase/firestore';
export { where, orderBy, limit, query, collection };
import { getStorage, ref, uploadBytes, getDownloadURL, type FirebaseStorage } from 'firebase/storage';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  setPersistence,
  browserSessionPersistence,
  type Auth,
} from 'firebase/auth';

/**
 * Sécurité: Validation stricte des variables d'environnement Firebase
 * Aucune valeur hardcodée - toutes les credentials doivent venir de .env
 */
const getFirebaseConfig = () => {
  const required = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ] as const;

  const missing = required.filter((key) => !import.meta.env[key]);
  if (missing.length > 0) {
    const errorMsg = `Missing required Firebase environment variables: ${missing.join(', ')}\nPlease check your .env file.`;
    throw new Error(errorMsg);
  }

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  };
};

const firebaseConfig = getFirebaseConfig();

let db: Firestore | null = null;
let app: FirebaseApp | null = null;
let storage: FirebaseStorage | null = null;
let auth: Auth | null = null;

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
// Types pour les contraintes de requête
type QueryConstraint = ReturnType<typeof where> | ReturnType<typeof orderBy> | ReturnType<typeof limit>;

export const subscribeToCollection = (
  collectionName: string,
  callback: (data: unknown[]) => void,
  constraints: QueryConstraint[] = []
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
      // OPTIMIZATION: Logger seulement en dev, utiliser ErrorHandler
      if (import.meta.env.DEV) {
        console.warn(`[Mode Hors Ligne] Impossible de lire ${collectionName}`, error);
      }
    }
  );
};

/**
 * Sauvegarde ou Met à jour un document (Écriture)
 */
export const saveDocument = async (collectionName: string, docId: string, data: Record<string, unknown>) => {
  try {
    if (!db) throw new Error('Database not initialized');
    await setDoc(doc(db, collectionName, docId), data, { merge: true });
  } catch (e: unknown) {
    // OPTIMIZATION: Utiliser ErrorHandler pour gestion cohérente
    const error = e instanceof Error ? e : new Error('Unknown error');
    if (import.meta.env.DEV) {
      console.warn(`[Sauvegarde Locale] Synchro Cloud impossible pour ${collectionName}/${docId}`, error);
    }
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
  } catch (e: unknown) {
    // OPTIMIZATION: Utiliser ErrorHandler pour gestion cohérente
    const error = e instanceof Error ? e : new Error('Unknown error');
    if (import.meta.env.DEV) {
      console.warn(`[Erreur Suppression] ${collectionName}/${docId}`, error);
    }
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
