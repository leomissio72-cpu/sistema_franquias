import crypto from "node:crypto";

type AnyRecord = Record<string, any>;

export interface StoredCredential {
  passwordHash?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
  mustReset?: boolean;
}

const PASSWORD_MIN_LENGTH = 12;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function isScryptHash(value: unknown): value is string {
  return typeof value === "string" && /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/i.test(value);
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")): string {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: unknown): boolean {
  if (!isScryptHash(storedHash)) return false;
  const [, salt, expected] = storedHash.split("$");
  try {
    const actual = crypto.scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expected, "hex");
    return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
  } catch {
    return false;
  }
}

function sessionSecret(): string {
  const configured = process.env.FRANQUIAS_SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    throw new Error("FRANQUIAS_SESSION_SECRET não configurado no ambiente de produção.");
  }
  return "local-development-session-secret-change-me-please";
}

function encode(value: AnyRecord): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function sign(value: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function base32Encode(value: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of value) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) output += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  return output;
}

function base32Decode(value: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

export function createTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function totpCode(secret: string, timestamp = Date.now()): string {
  const counter = Math.floor(timestamp / 30000);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const number = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(number % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: string, input: string): boolean {
  const code = String(input || "").replace(/\D/g, "");
  if (code.length !== 6) return false;
  return [-1, 0, 1].some((offset) => crypto.timingSafeEqual(Buffer.from(totpCode(secret, Date.now() + offset * 30000)), Buffer.from(code)));
}

function encryptionKey(): Buffer {
  return crypto.createHash("sha256").update(sessionSecret()).digest();
}

export function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string): string | null {
  try {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function createMfaChallenge(userId: string, purpose: "mfa-setup" | "mfa-login" = "mfa-setup"): string {
  const payload = encode({ sub: userId, purpose, exp: Date.now() + 10 * 60 * 1000, nonce: crypto.randomBytes(16).toString("hex") });
  return `${payload}.${sign(payload)}`;
}

export function verifyMfaChallenge(value: string): { sub: string; purpose: "mfa-setup" | "mfa-login" } | null {
  try {
    const [payload, signature] = value.split(".");
    if (!payload || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return ["mfa-setup", "mfa-login"].includes(parsed?.purpose) && Number(parsed.exp) > Date.now() && parsed.sub
      ? { sub: String(parsed.sub), purpose: parsed.purpose }
      : null;
  } catch {
    return null;
  }
}

export function totpUri(secret: string, login: string): string {
  return `otpauth://totp/Gestao%20de%20Franquias:${encodeURIComponent(login)}?secret=${secret}&issuer=Gestao%20de%20Franquias&algorithm=SHA1&digits=6&period=30`;
}

export function createSignedSessionToken(userId: string, credentialVersion: number, mfaVerified = false): string {
  const payload = encode({
    sub: userId,
    cv: credentialVersion,
    mfa: mfaVerified,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
    nonce: crypto.randomBytes(16).toString("hex"),
  });
  return `${payload}.${sign(payload)}`;
}

export function verifySignedSessionToken(token: string): { sub: string; cv: number; mfa: boolean; exp: number } | null {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed?.sub || Number(parsed.exp) <= Date.now()) return null;
    return { sub: String(parsed.sub), cv: Number(parsed.cv) || 0, mfa: Boolean(parsed.mfa), exp: Number(parsed.exp) };
  } catch {
    return null;
  }
}

export function cookieOptions(maxAgeSeconds = 8 * 60 * 60): string {
  return `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function safeUser(user: AnyRecord): AnyRecord {
  const { pass: _pass, password: _password, senha: _senha, senhaInicial: _senhaInicial, passwordHash: _passwordHash, accessPassword: _accessPassword, ...publicUser } = user;
  return publicUser;
}

export function stripSensitiveFields(value: any): any {
  if (Array.isArray(value)) return value.map(stripSensitiveFields);
  if (!value || typeof value !== "object") return value;
  const result: AnyRecord = {};
  for (const [key, item] of Object.entries(value)) {
    if (["pass", "password", "senha", "senhaInicial", "passwordHash", "accessPassword", "access_password", "token", "sessionToken"].includes(key)) continue;
    result[key] = stripSensitiveFields(item);
  }
  return result;
}

export function migrateLegacyCredentials(database: AnyRecord): { database: AnyRecord; changed: boolean } {
  const next: AnyRecord = { ...database, users: Array.isArray(database.users) ? [...database.users] : [] };
  const credentials: Record<string, StoredCredential> = { ...(database.credentials || {}) };
  let changed = false;
  next.users = next.users.map((user: AnyRecord) => {
    const copy = { ...user };
    const legacy = copy.pass || copy.password || copy.senha || copy.senhaInicial;
    if (legacy && !credentials[copy.id]) {
      const now = new Date().toISOString();
      credentials[copy.id] = { version: 0, createdAt: now, updatedAt: now, revokedAt: now, mustReset: true };
      changed = true;
    }
    if ("pass" in copy || "password" in copy || "senha" in copy || "senhaInicial" in copy) changed = true;
    delete copy.pass;
    delete copy.password;
    delete copy.senha;
    delete copy.senhaInicial;
    return copy;
  });
  next.employees = Array.isArray(database.employees)
    ? database.employees.map((employee: AnyRecord) => {
        const copy = { ...employee };
        if ("accessPassword" in copy) changed = true;
        delete copy.accessPassword;
        return copy;
      })
    : [];
  if (Object.keys(credentials).length > 0 && JSON.stringify(database.credentials || {}) !== JSON.stringify(credentials)) changed = true;
  next.credentials = credentials;
  return { database: next, changed };
}

export function setCredential(database: AnyRecord, userId: string, password: string): AnyRecord {
  const now = new Date().toISOString();
  const current = database.credentials?.[userId];
  const nextCredentials = {
    ...(database.credentials || {}),
    [userId]: {
      passwordHash: hashPassword(password),
      version: Number(current?.version || 0) + 1,
      createdAt: current?.createdAt || now,
      updatedAt: now,
      revokedAt: undefined,
      mustReset: false,
    },
  };
  return { ...database, credentials: nextCredentials };
}

export function getCredential(database: AnyRecord, userId: string): StoredCredential | null {
  const credential = database.credentials?.[userId];
  return credential && !credential.revokedAt && !credential.mustReset && credential.passwordHash ? credential : null;
}

export function passwordMinLength(): number {
  return PASSWORD_MIN_LENGTH;
}

export function sessionTtlMs(): number {
  return SESSION_TTL_MS;
}
