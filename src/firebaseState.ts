import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
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
  "intercompanyRules",
  "whatsappConfig",
  "whatsappHistory",
];

let mirrorWriteChain: Promise<void> = Promise.resolve();

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

  const writeOperation = async () => {
    try {
      if (!(await ensureFirebaseSession())) return false;
      const existing = await readFirebaseMirror();
      const operationalKeys: Array<keyof CloudState> = [
        "businesses", "franchises", "employees", "manualEntries", "bills", "products", "suppliers", "whatsappHistory", "intercompanyRules",
      ];
      const incomingIsGloballyEmpty = operationalKeys.every((key) => Array.isArray(state[key]) && state[key].length === 0);
      const existingHasRecords = Boolean(existing && operationalKeys.some((key) => Array.isArray(existing[key]) && existing[key].length > 0));
      if (incomingIsGloballyEmpty && existingHasRecords) {
        console.warn("Ignorando espelho vazio para preservar dados existentes no Firestore.");
        return false;
      }

      const updatedAt = new Date().toISOString();
      const batch = writeBatch(firebaseDb);
      STATE_KEYS.filter((key) => state[key] !== undefined).forEach((key) => {
        batch.set(
          doc(firebaseDb, STATE_COLLECTION, String(key)),
          { value: stripSensitive(state[key]), updatedAt },
          { merge: true },
        );
      });
      await batch.commit();
      return true;
    } catch (error) {
      console.warn("Firebase mirror write unavailable; authenticated API remains active:", error);
      return false;
    }
  };

  const queuedWrite = mirrorWriteChain.then(writeOperation, writeOperation);
  mirrorWriteChain = queuedWrite.then(() => undefined, () => undefined);
  return queuedWrite;
}
