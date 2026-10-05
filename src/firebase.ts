import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase Web configuration is public by design. Security is enforced by
// Firebase Authentication and Firestore rules, never by hiding this object.
export const firebaseConfig = {
  apiKey: "AIzaSyDDx2A4irYyhWhkPrhQwx64UBGRkoqMiA7",
  authDomain: "gestao-de-franquias.firebaseapp.com",
  projectId: "gestao-de-franquias",
  storageBucket: "gestao-de-franquias.firebasestorage.app",
  messagingSenderId: "1043124205322",
  appId: "1:1043124205322:web:4ad767e92e124b5d6cacf3",
  measurementId: "G-N8SY71N98Z",
};

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseDb = getFirestore(firebaseApp);

let firebaseSessionPromise: Promise<boolean> | null = null;

export async function ensureFirebaseSession(): Promise<boolean> {
  if (firebaseAuth.currentUser) return true;
  if (!firebaseSessionPromise) {
    firebaseSessionPromise = signInAnonymously(firebaseAuth)
      .then(() => true)
      .catch((error) => {
        firebaseSessionPromise = null;
        console.warn("Firebase Authentication is not enabled for this project:", error);
        return false;
      });
  }
  return firebaseSessionPromise;
}
