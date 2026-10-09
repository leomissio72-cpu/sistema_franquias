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
  "intercompanySeedVersion",
];

let mirrorWriteChain: Promise<void> = Promise.resolve();
let mirrorAvailable = false;
// Disjuntor para cotas de escrita gratuita esgotadas no Firestore
let writeQuotaExhausted = false;
const QUOTA_FLAG_KEY = "fs_write_quota_exhausted_v2";
const QUOTA_MARKED_AT_KEY = "fs_write_quota_marked_at_v2";
try {
  if (typeof window !== "undefined") {
    const isExhausted = window.localStorage?.getItem(QUOTA_FLAG_KEY) === "1";
    const markedAt = Number(window.localStorage?.getItem(QUOTA_MARKED_AT_KEY) || 0);
    // Permite retentar após 8 horas ou se foi redefinido manualmente
    if (isExhausted && Date.now() - markedAt < 8 * 60 * 60 * 1000) {
      writeQuotaExhausted = true;
    }
  }
} catch {}

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

function setWriteQuotaExhausted() {
  writeQuotaExhausted = true;
  try {
    if (typeof window !== "undefined") {
      window.localStorage?.setItem(QUOTA_FLAG_KEY, "1");
      window.localStorage?.setItem(QUOTA_MARKED_AT_KEY, String(Date.now()));
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

export function isFirebaseMirrorAvailable(): boolean {
  return mirrorAvailable;
}

/**
 * Reads the optional Firebase mirror with a strict timeout. The API remains the authoritative,
 * authenticated source; Firebase is only used when this mirror is available.
 */
export async function readFirebaseMirror(timeoutMs = 2000): Promise<CloudState | null> {
  if (!isFirebaseConfigured()) {
    mirrorAvailable = false;
    return null;
  }

  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });

  const readPromise = (async (): Promise<CloudState | null> => {
    try {
      if (!(await ensureFirebaseSession())) {
        mirrorAvailable = false;
        return null;
      }
      const snapshot = await getDocs(collection(firebaseDb, STATE_COLLECTION));
      mirrorAvailable = true;
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
        setWriteQuotaExhausted();
        mirrorAvailable = false;
        console.info("Firebase Firestore limite de cota atingido; operando com API central.");
        return null;
      }
      mirrorAvailable = false;
      console.warn("Firebase mirror read unavailable; using authenticated API:", error?.message || error);
      return null;
    }
  })();

  return Promise.race([readPromise, timeoutPromise]);
}

/**
 * Writes only sanitized application sections. Credentials and session tokens
 * are deliberately removed before any value reaches Firestore.
 */
export async function writeFirebaseMirror(state: CloudState, options: { allowEmptyReset?: boolean } = {}): Promise<boolean> {
  if (writeQuotaExhausted || !isFirebaseConfigured() || !state) return false;

  const writeOperation = async (): Promise<boolean> => {
    if (writeQuotaExhausted) return false;
    const execute = async () => {
      try {
        if (!(await ensureFirebaseSession())) {
          mirrorAvailable = false;
          return false;
        }
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
        mirrorAvailable = true;
        return true;
      } catch (error: any) {
        if (isQuotaExhaustedError(error)) {
          setWriteQuotaExhausted();
          mirrorAvailable = false;
          console.info("Firebase Firestore cota de escrita atingida; pausando sincronização no espelho para evitar erros.");
          return false;
        }
        mirrorAvailable = false;
        console.warn("Firebase mirror write unavailable; authenticated API remains active:", error?.message || error);
        return false;
      }
    };

    const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000));
    return Promise.race([execute(), timeout]);
  };

  const queuedWrite = mirrorWriteChain.then(writeOperation, writeOperation);
  mirrorWriteChain = queuedWrite.then(() => undefined, () => undefined);
  return queuedWrite;
}
