import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { ensureFirebaseSession, firebaseDb } from "./firebase";
import { CloudState } from "./types";

const STATE_COLLECTION = "franquias_state";
const SENSITIVE_KEYS = new Set([
  "password",
  "pass",
  "senha",
  "senhaInicial",
  "passwordHash",
  "accessPassword",
  "access_password",
  "token",
  "sessionToken",
  "secret",
]);

const STATE_KEYS: Array<keyof CloudState> = [
  "version",
  "lastUpdated",
  "configs",
  "auditLogs",
  "businesses",
  "franchises",
  "employees",
  "users",
  "manualEntries",
  "dreParams",
  "paymentMethods",
  "businessRules",
  "royalties",
  "permissions",
  "vtConfigs",
  "systemSettings",
  "bills",
  "products",
  "suppliers",
  "whatsappConfig",
  "whatsappHistory",
];

function stripSensitive(value: any): any {
  if (Array.isArray(value)) return value.map(stripSensitive);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEYS.has(key))
      .map(([key, item]) => [key, stripSensitive(item)])
  );
}

function isFirebaseConfigured() {
  return Boolean(firebaseDb);
}

/**
 * Reads the optional Firebase mirror. The API remains the authoritative,
 * authenticated source; Firebase is only used when this mirror is available.
 */
export async function readFirebaseMirror(): Promise<CloudState | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    if (!(await ensureFirebaseSession())) return null;
    const snapshot = await getDocs(collection(firebaseDb, STATE_COLLECTION));
    if (snapshot.empty) return null;
    const state: Record<string, any> = {};
    snapshot.forEach((item) => {
      const data = item.data();
      if (data && Object.prototype.hasOwnProperty.call(data, "value")) {
        state[item.id] = data.value;
      }
    });
    return state as CloudState;
  } catch (error) {
    console.warn("Firebase mirror read unavailable; using authenticated API:", error);
    return null;
  }
}

/**
 * Writes only sanitized application sections. Credentials and session tokens
 * are deliberately removed before any value reaches Firestore.
 */
export async function writeFirebaseMirror(state: CloudState): Promise<boolean> {
  if (!isFirebaseConfigured() || !state) return false;
  try {
    if (!(await ensureFirebaseSession())) return false;
    const updatedAt = new Date().toISOString();
    await Promise.all(
      STATE_KEYS.filter((key) => state[key] !== undefined).map((key) =>
        setDoc(
          doc(firebaseDb, STATE_COLLECTION, String(key)),
          { value: stripSensitive(state[key]), updatedAt },
          { merge: true }
        )
      )
    );
    return true;
  } catch (error) {
    console.warn("Firebase mirror write unavailable; authenticated API remains active:", error);
    return false;
  }
}
