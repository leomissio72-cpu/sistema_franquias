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
];

let mirrorWriteChain: Promise<void> = Promise.resolve();
// O projeto com cota gratuita diária esgotada no Firestore entra diretamente em modo de proteção
// para evitar chamadas de escrita que geram loops de backoff e erros de quota no SDK.
let quotaExhausted = true;

function isQuotaExhaustedError(error: any): boolean {
  if (!error) return false;
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  const str = String(error);
  return (
    code.includes("resource-exhausted") ||
    message.includes("Quota limit exceeded") ||
    message.includes("Free daily write units") ||
    message.includes("quota metric") ||
    str.includes("resource-exhausted") ||
    str.includes("Quota limit exceeded")
  );
}

function checkQuotaState(): boolean {
  if (typeof window !== "undefined" && window.localStorage?.getItem("fs_enable_writes") === "1") {
    return false;
  }
  return quotaExhausted;
}

function setQuotaExhausted() {
  quotaExhausted = true;
  try {
    if (typeof window !== "undefined") {
      window.localStorage?.setItem("fs_quota_exhausted", "1");
    }
  } catch {}
}

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
  if (checkQuotaState() || !isFirebaseConfigured()) return null;
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
  } catch (error: any) {
    if (isQuotaExhaustedError(error)) {
      setQuotaExhausted();
      console.info("Firebase Firestore limite de cota diária atingido; operando com armazenamento autenticado.");
      return null;
    }
    console.warn("Firebase mirror read unavailable; using authenticated API:", error?.message || error);
    return null;
  }
}

/**
 * Writes only sanitized application sections. Credentials and session tokens
 * are deliberately removed before any value reaches Firestore.
 */
export async function writeFirebaseMirror(state: CloudState, options: { allowEmptyReset?: boolean } = {}): Promise<boolean> {
  if (checkQuotaState() || !isFirebaseConfigured() || !state) return false;

  const writeOperation = async () => {
    if (checkQuotaState()) return false;
    try {
      if (!(await ensureFirebaseSession())) return false;
      const operationalKeys: Array<keyof CloudState> = [
        "businesses", "franchises", "employees", "manualEntries", "bills", "products", "suppliers", "intercompanyRules",
      ];
      const incomingIsGloballyEmpty = operationalKeys.every((key) => Array.isArray(state[key]) && state[key].length === 0);
      
      if (incomingIsGloballyEmpty && !options.allowEmptyReset) {
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
    } catch (error: any) {
      if (isQuotaExhaustedError(error)) {
        setQuotaExhausted();
        console.info("Firebase Firestore cota diária atingida; operando com armazenamento persistente seguro.");
        return false;
      }
      console.warn("Firebase mirror write unavailable; authenticated API remains active:", error?.message || error);
      return false;
    }
  };

  const queuedWrite = mirrorWriteChain.then(writeOperation, writeOperation);
  mirrorWriteChain = queuedWrite.then(() => undefined, () => undefined);
  return queuedWrite;
}
