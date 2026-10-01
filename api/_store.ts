import fs from "node:fs";
import path from "node:path";
import { get as getBlob, put as putBlob } from "@vercel/blob";
import {
  cookieOptions,
  migrateLegacyCredentials,
  safeUser,
  stripSensitiveFields,
  verifySignedSessionToken,
} from "../src/serverSecurity";

const TEMP_DB = "/tmp/gestao-franquias-database.json";
const sourceCandidates = [
  TEMP_DB,
  path.join(process.cwd(), "data", "database.json"),
  path.join(process.cwd(), "database.json"),
  path.join("/var/task", "data", "database.json"),
];

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const KV_KEY = process.env.FRANQUIAS_STATE_KEY || "gestao-franquias:database:v2";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
const BLOB_PATH = process.env.FRANQUIAS_BLOB_PATH || "database/gestao-franquias-state.json";
const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

function assertDurableStore() {
  if (IS_PRODUCTION && !((KV_URL && KV_TOKEN) || BLOB_TOKEN)) {
    throw new Error("Armazenamento durável não configurado: conecte o Blob privado ou KV antes de usar produção.");
  }
}

function emptyDatabase(): any {
  return { version: 2, users: [], credentials: {}, manualEntries: [], businesses: [], franchises: [], employees: [], configs: [], lastUpdated: null };
}

function localReadDatabase(): any {
  for (const file of sourceCandidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.users)) return parsed;
    } catch {
      // Tenta a próxima origem sem substituir dados válidos por um estado vazio.
    }
  }
  return emptyDatabase();
}

function kvHeaders() {
  return { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" };
}

async function kvCommand(command: string[]): Promise<any> {
  if (!KV_URL || !KV_TOKEN) return null;
  const response = await fetch(KV_URL, { method: "POST", headers: kvHeaders(), body: JSON.stringify(command) });
  if (!response.ok) throw new Error(`KV ${response.status}`);
  const payload = await response.json().catch(() => ({}));
  return payload?.result ?? payload;
}

function hasDatabaseShape(value: any): boolean {
  return Boolean(value && typeof value === "object" && Array.isArray(value.users));
}

async function blobReadDatabase(): Promise<any | null> {
  if (!BLOB_TOKEN) return null;
  const result = await getBlob(BLOB_PATH, { access: "private", useCache: false, token: BLOB_TOKEN });
  if (!result) return null;
  const parsed = JSON.parse(await new Response(result.stream).text());
  return hasDatabaseShape(parsed) ? parsed : null;
}

async function blobWriteDatabase(db: any): Promise<void> {
  if (!BLOB_TOKEN) return;
  await putBlob(BLOB_PATH, JSON.stringify(db), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: BLOB_TOKEN,
  });
}

function normalizeDatabase(raw: any): { database: any; changed: boolean } {
  const migrated = migrateLegacyCredentials(raw && typeof raw === "object" ? raw : emptyDatabase());
  const database = { ...migrated.database, version: Math.max(2, Number(migrated.database.version || 1)) };
  return { database, changed: migrated.changed || database.version !== raw?.version };
}

async function persistMigration(database: any): Promise<void> {
  if (KV_URL && KV_TOKEN) {
    try { await kvCommand(["SET", KV_KEY, JSON.stringify(database)]); } catch { /* próxima leitura tenta novamente */ }
  }
  if (BLOB_TOKEN) {
    try { await blobWriteDatabase(database); } catch { /* próxima leitura tenta novamente */ }
  }
  try { fs.writeFileSync(TEMP_DB, JSON.stringify(database, null, 2), "utf8"); } catch { /* ambiente somente leitura */ }
}

export async function readDatabase(): Promise<any> {
  assertDurableStore();
  let raw: any = null;
  if (KV_URL && KV_TOKEN) {
    try {
      const value = await kvCommand(["GET", KV_KEY]);
      if (typeof value === "string" && value.trim()) {
        const parsed = JSON.parse(value);
        if (hasDatabaseShape(parsed)) raw = parsed;
      }
    } catch (error) {
      console.warn("Não foi possível ler o KV; tentando Blob/fallback local.", error);
    }
  }
  if (!raw && BLOB_TOKEN) {
    try {
      raw = await blobReadDatabase();
    } catch (error) {
      if (IS_PRODUCTION && !(KV_URL && KV_TOKEN)) throw error;
      console.warn("Não foi possível ler o Blob privado; usando fallback local.", error);
    }
  }
  if (!raw && IS_PRODUCTION) throw new Error("A base durável não retornou dados válidos; nenhum estado local foi usado.");
  if (!raw) raw = localReadDatabase();

  const { database, changed } = normalizeDatabase(raw);
  if (changed) await persistMigration(database);
  return database;
}

export async function writeDatabase(db: any): Promise<void> {
  assertDurableStore();
  const { database } = normalizeDatabase(db);
  const next = { ...database, version: 2, lastUpdated: new Date().toISOString() };
  try { fs.writeFileSync(TEMP_DB, JSON.stringify(next, null, 2), "utf8"); } catch { /* filesystem efêmero */ }
  if (KV_URL && KV_TOKEN) await kvCommand(["SET", KV_KEY, JSON.stringify(next)]);
  if (BLOB_TOKEN) await blobWriteDatabase(next);
}

export function json(res: any, status: number, payload: any): any {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(status).json(payload);
}

export function readRequestBody(req: any): any {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

export function isTrustedRequest(req: any): boolean {
  const origin = String(req.headers?.origin || "").trim();
  if (!origin) return true;
  const host = String(req.headers?.host || "").trim();
  try {
    const parsed = new URL(origin);
    if (parsed.host === host) return true;
    return process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
  } catch { return false; }
}

export async function sessionUser(req: any): Promise<any | null> {
  const cookieHeader = String(req.headers?.cookie || "");
  const raw = cookieHeader.match(/(?:^|;\s*)gestao_session=([^;]+)/)?.[1];
  if (!raw) return null;
  const token = decodeURIComponent(raw);
  const session = verifySignedSessionToken(token);
  if (!session) return null;
  const db = await readDatabase();
  const user = (db.users || []).find((candidate: any) => candidate.id === session.sub && candidate.status !== "inativo");
  const credential = db.credentials?.[session.sub];
  if (!user || !credential || Number(credential.version) !== session.cv) return null;
  if (user.perfil === "dono" && !session.mfa) return null;
  return { ...safeUser(user), mfaVerified: session.mfa, credentialVersion: credential.version };
}

export function sessionCookie(token: string): string {
  return `gestao_session=${encodeURIComponent(token)}; ${cookieOptions()}`;
}

export function clearSessionCookies(): string[] {
  const expired = "Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
  return [`gestao_session=; ${cookieOptions(0)}; ${expired}`, `sofia_session=; ${cookieOptions(0)}; ${expired}`];
}

export function publicState(db: any): any {
  const safe = stripSensitiveFields({ ...db, credentials: undefined });
  delete safe.credentials;
  return safe;
}

export { safeUser };
