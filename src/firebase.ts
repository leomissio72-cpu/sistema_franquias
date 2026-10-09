import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import appletConfig from "../firebase-applet-config.json";

export const firebaseConfig = appletConfig && appletConfig.projectId ? {
  apiKey: appletConfig.apiKey,
  authDomain: appletConfig.authDomain,
  projectId: appletConfig.projectId,
  storageBucket: appletConfig.storageBucket,
  messagingSenderId: appletConfig.messagingSenderId,
  appId: appletConfig.appId,
} : {
  apiKey: "AIzaSyDDx2A4irYyhWhkPrhQwx64UBGRkoqMi7A",
  authDomain: "gestao-de-franquias.firebaseapp.com",
  projectId: "gestao-de-franquias",
  storageBucket: "gestao-de-franquias.firebasestorage.app",
  messagingSenderId: "1043124205322",
  appId: "1:1043124205322:web:4ad767e92e124b5d6cacf3",
  measurementId: "G-N8SY71N98Z",
};

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseDb = appletConfig && (appletConfig as any).firestoreDatabaseId
  ? getFirestore(firebaseApp, (appletConfig as any).firestoreDatabaseId)
  : getFirestore(firebaseApp);

let firebaseSessionPromise: Promise<boolean> | null = null;

export async function ensureFirebaseSession(): Promise<boolean> {
  if (firebaseAuth.currentUser) return true;
  if (!firebaseSessionPromise) {
    firebaseSessionPromise = signInAnonymously(firebaseAuth)
      .then(() => true)
      .catch((error) => {
        // O espelho usa regras autenticadas. Retornar true após uma falha
        // mascarava o erro e fazia o app parecer sincronizado sem gravar.
        console.warn("Firebase Anonymous Auth unavailable:", error?.message || error);
        firebaseSessionPromise = null;
        return false;
      });
  }
  return firebaseSessionPromise;
}
