var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/serverBackend.ts
var serverBackend_exports = {};
__export(serverBackend_exports, {
  app: () => app,
  db: () => db,
  default: () => serverBackend_default,
  loadDatabase: () => loadDatabase,
  saveDatabase: () => saveDatabase
});
module.exports = __toCommonJS(serverBackend_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_blob = require("@vercel/blob");

// src/data/initialData.ts
var initialBusinesses = [
  {
    id: "lavo",
    royaltyType: "pct",
    name: "LAVO",
    royalty: 0,
    color: "#3c63da",
    brand: "LAVO"
  },
  {
    id: "mexicano",
    brand: "MEXICANISSIMO",
    color: "#3c63da",
    name: "MEXICANISSIMO",
    royaltyType: "pct",
    royalty: 0
  }
];
var initialFranchises = [
  {
    id: "f_1791493345753",
    code: "LV-01",
    name: "Vila Ol\xEDmpia",
    businessId: "lavo",
    city: "S\xE3o Paulo",
    region: "Sudeste",
    address: "Rua Alvorada, 550",
    lat: -23.7761745,
    lng: -46.6757729,
    resp: "Rodrigo",
    email: "",
    phone: "",
    faturamento: 0,
    status: "green",
    active: true,
    coordinatesVerified: true,
    pendencias: 0,
    rpDone: 5
  },
  {
    id: "f_1791493393092",
    code: "LV-02",
    name: "Clodomiro",
    businessId: "lavo",
    city: "S\xC3O PAULO",
    region: "Sudeste",
    address: "Rua Clodomiro Amazonas 980",
    lat: -23.5928422,
    lng: -46.6773993,
    resp: "RODRIGO",
    email: "",
    phone: "",
    faturamento: 0,
    status: "green",
    active: true,
    coordinatesVerified: true,
    pendencias: 0,
    rpDone: 5
  },
  {
    id: "f_1791493433153",
    code: "LV-03",
    name: "Brooklin",
    businessId: "lavo",
    city: "S\xC3O PAULO",
    region: "Sudeste",
    address: "Av santo Amaro 3252",
    lat: -23.6127394,
    lng: -46.6782742,
    resp: "RODRIGO",
    email: "",
    phone: "",
    faturamento: 0,
    status: "green",
    active: true,
    coordinatesVerified: true,
    pendencias: 0,
    rpDone: 5
  },
  {
    id: "f_1791493489437",
    code: "LV-04",
    name: "Morumbi",
    businessId: "lavo",
    city: "S\xC3O PAULO",
    region: "Sudeste",
    address: "Av Giovanni Gronchi 3577",
    lat: -23.6376932,
    lng: -46.7369104,
    resp: "RODRIGO",
    email: "",
    phone: "",
    faturamento: 0,
    status: "green",
    active: true,
    coordinatesVerified: true,
    pendencias: 0,
    rpDone: 5
  },
  {
    id: "f_1791493539509",
    code: "LV-05",
    name: "Santo Andr\xE9",
    businessId: "lavo",
    city: "S\xC3O PAULO",
    region: "Sudeste",
    address: "Av dos estados, 1586",
    lat: -23.6263972,
    lng: -46.540195,
    resp: "RODRIGO",
    email: "",
    phone: "",
    faturamento: 0,
    status: "green",
    active: true,
    coordinatesVerified: true,
    pendencias: 0,
    rpDone: 5
  },
  {
    id: "f_1791493654697",
    code: "M-01",
    name: "MEXICANO",
    businessId: "mexicano",
    city: "Santo Andr\xE9",
    region: "Sudeste",
    address: "Rua das Figueiras, 780, Santo Andr\xE9 - SP, 09080-300",
    lat: -23.6470113,
    lng: -46.5410612,
    resp: "RODRIGO",
    email: "",
    phone: "",
    faturamento: 0,
    status: "green",
    active: true,
    coordinatesVerified: true,
    pendencias: 0,
    rpDone: 5
  }
];
var initialBills = [];
var initialConfigs = [
  {
    key: "app_name",
    name: "Nome da Plataforma",
    value: "Gest\xE3o de Franquias \u2014 SaaS Financeiro para Franquias",
    type: "string",
    category: "Geral",
    description: "Nome exibido no cabe\xE7alho e relat\xF3rios",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "tax_default",
    name: "Al\xEDquota Padr\xE3o de Impostos (%)",
    value: "8.00",
    type: "number",
    category: "Financeiro",
    description: "Imposto sobre vendas padr\xE3o aplicado \xE0s franquias",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "cmv_default",
    name: "CMV Padr\xE3o (%)",
    value: "30.00",
    type: "number",
    category: "Financeiro",
    description: "Custo de Mercadoria Vendida padr\xE3o estimado",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "royalty_default",
    name: "Royalty M\xE9dio de Franquia (%)",
    value: "6.00",
    type: "number",
    category: "Financeiro",
    description: "Percentual sobre receita bruta pago \xE0 matriz",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "max_discount_limit",
    name: "Limite M\xE1ximo de Desconto (%)",
    value: "15.00",
    type: "number",
    category: "Regras de Neg\xF3cio",
    description: "Desconto m\xE1ximo permitido sem autoriza\xE7\xE3o da diretoria",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "bank_cutoff_hour",
    name: "Hor\xE1rio de Corte Banc\xE1rio Padr\xE3o",
    value: "18:00",
    type: "string",
    category: "Regras de Neg\xF3cio",
    description: "Vendas ap\xF3s este hor\xE1rio s\xE3o liquidadas no ciclo seguinte",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "realtime_sync_enabled",
    name: "Sincroniza\xE7\xE3o em Tempo Real",
    value: "true",
    type: "boolean",
    category: "Sincroniza\xE7\xE3o",
    description: "Propaga\xE7\xE3o instant\xE2nea de altera\xE7\xF5es para todos os aparelhos conectados",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "audit_log_retention_days",
    name: "Reten\xE7\xE3o de Logs de Auditoria (dias)",
    value: "90",
    type: "number",
    category: "Seguran\xE7a",
    description: "Tempo de armazenamento do hist\xF3rico de altera\xE7\xF5es administrativas",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "two_factor_auth_required",
    name: "Exigir 2FA para Administradores",
    value: "true",
    type: "boolean",
    category: "Seguran\xE7a",
    description: "Obrigatoriedade de autentica\xE7\xE3o de dois fatores no painel administrativo",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "auto_conciliation_threshold",
    name: "Toler\xE2ncia de Concilia\xE7\xE3o Autom\xE1tica (R$)",
    value: "0.05",
    type: "number",
    category: "Opera\xE7\xE3o",
    description: "Diferen\xE7a m\xE1xima aceita para correspond\xEAncia autom\xE1tica de extrato",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "system_maintenance_mode",
    name: "Modo de Manuten\xE7\xE3o",
    value: "false",
    type: "boolean",
    category: "Geral",
    description: "Bloqueia edi\xE7\xF5es por franqueados mantendo apenas leitura",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  }
];

// src/serverSecurity.ts
var import_node_crypto = __toESM(require("node:crypto"), 1);
var PASSWORD_MIN_LENGTH = 3;
var SESSION_TTL_MS = 8 * 60 * 60 * 1e3;
var developmentSessionSecret = "gestao-franquias-stable-session-dev-key-2026-d20476d4";
var persistedCredentialSecret = null;
function isScryptHash(value) {
  return typeof value === "string" && /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/i.test(value);
}
function hashPassword(password, salt = import_node_crypto.default.randomBytes(16).toString("hex")) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }
  return `scrypt$${salt}$${import_node_crypto.default.scryptSync(password, salt, 64).toString("hex")}`;
}
function verifyPassword(password, storedHash) {
  if (!isScryptHash(storedHash)) return false;
  const [, salt, expected] = storedHash.split("$");
  try {
    const actual = import_node_crypto.default.scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expected, "hex");
    return actual.length === expectedBuffer.length && import_node_crypto.default.timingSafeEqual(actual, expectedBuffer);
  } catch {
    return false;
  }
}
function configureSessionSecretFallback(passwordHashes) {
  const hashes = (Array.isArray(passwordHashes) ? passwordHashes : [passwordHashes]).filter(isScryptHash).sort();
  persistedCredentialSecret = hashes.length > 0 ? import_node_crypto.default.createHash("sha256").update("gestao-franquias-session-fallback:v1\0").update(hashes.join("\0")).digest("hex") : null;
}
function sessionSecret() {
  const configured = process.env.FRANQUIAS_SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (persistedCredentialSecret) return persistedCredentialSecret;
  return developmentSessionSecret;
}
function encode(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
function sign(value) {
  return import_node_crypto.default.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}
function base32Encode(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of value) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) output += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  return output;
}
function base32Decode(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}
function createTotpSecret() {
  return base32Encode(import_node_crypto.default.randomBytes(20));
}
function totpCode(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 3e4);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = import_node_crypto.default.createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const number = (digest[offset] & 127) << 24 | digest[offset + 1] << 16 | digest[offset + 2] << 8 | digest[offset + 3];
  return String(number % 1e6).padStart(6, "0");
}
function verifyTotp(secret, input) {
  const code = String(input || "").replace(/\D/g, "");
  if (code.length !== 6) return false;
  return [-1, 0, 1].some((offset) => import_node_crypto.default.timingSafeEqual(Buffer.from(totpCode(secret, Date.now() + offset * 3e4)), Buffer.from(code)));
}
function encryptionKey() {
  return import_node_crypto.default.createHash("sha256").update(sessionSecret()).digest();
}
function encryptSecret(secret) {
  const iv = import_node_crypto.default.randomBytes(12);
  const cipher = import_node_crypto.default.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
function decryptSecret(value) {
  try {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    const decipher = import_node_crypto.default.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
function vaultKey(keyMaterial) {
  const configured = process.env.FRANQUIAS_SESSION_SECRET;
  const base = configured && configured.length >= 32 ? configured : keyMaterial;
  return import_node_crypto.default.createHash("sha256").update("gestao-franquias-access-vault:v1\0").update(base).digest();
}
function sealAccessVault(payload, keyMaterial) {
  const iv = import_node_crypto.default.randomBytes(12);
  const cipher = import_node_crypto.default.createCipheriv("aes-256-gcm", vaultKey(keyMaterial), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
function openAccessVault(value, keyMaterial) {
  try {
    if (typeof value !== "string" || value.length > 4e5) return null;
    const [version, ivValue, tagValue, encryptedValue] = value.split(".");
    if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) return null;
    const decipher = import_node_crypto.default.createDecipheriv("aes-256-gcm", vaultKey(keyMaterial), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const text = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
function createMfaChallenge(userId, purpose = "mfa-setup") {
  const payload = encode({ sub: userId, purpose, exp: Date.now() + 10 * 60 * 1e3, nonce: import_node_crypto.default.randomBytes(16).toString("hex") });
  return `${payload}.${sign(payload)}`;
}
function verifyMfaChallenge(value) {
  try {
    const [payload, signature] = value.split(".");
    if (!payload || !signature || !import_node_crypto.default.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return ["mfa-setup", "mfa-login"].includes(parsed?.purpose) && Number(parsed.exp) > Date.now() && parsed.sub ? { sub: String(parsed.sub), purpose: parsed.purpose } : null;
  } catch {
    return null;
  }
}
function totpUri(secret, login) {
  return `otpauth://totp/Gestao%20de%20Franquias:${encodeURIComponent(login)}?secret=${secret}&issuer=Gestao%20de%20Franquias&algorithm=SHA1&digits=6&period=30`;
}
function createSignedSessionToken(userId, credentialVersion, mfaVerified = false) {
  const payload = encode({
    sub: userId,
    cv: credentialVersion,
    mfa: mfaVerified,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
    nonce: import_node_crypto.default.randomBytes(16).toString("hex")
  });
  return `${payload}.${sign(payload)}`;
}
function verifySignedSessionToken(token) {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !import_node_crypto.default.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed?.sub || Number(parsed.exp) <= Date.now()) return null;
    return { sub: String(parsed.sub), cv: Number(parsed.cv) || 0, mfa: Boolean(parsed.mfa), exp: Number(parsed.exp), iat: Number(parsed.iat) || void 0 };
  } catch {
    return null;
  }
}
function cookieOptions(maxAgeSeconds = 8 * 60 * 60) {
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  const secureFlag = isProd ? "Secure; " : "";
  return `HttpOnly; ${secureFlag}SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}
function safeUser(user) {
  const { pass: _pass, password: _password, senha: _senha, senhaInicial: _senhaInicial, passwordHash: _passwordHash, accessPassword: _accessPassword, ...publicUser } = user;
  return publicUser;
}
function stripSensitiveFields(value) {
  if (Array.isArray(value)) return value.map(stripSensitiveFields);
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (["pass", "password", "senha", "senhaInicial", "passwordHash", "accessPassword", "access_password", "token", "sessionToken"].includes(key)) continue;
    result[key] = stripSensitiveFields(item);
  }
  return result;
}
function migrateLegacyCredentials(database) {
  const next = { ...database, users: Array.isArray(database.users) ? [...database.users] : [] };
  const credentials = { ...database.credentials || {} };
  let changed = false;
  next.users = next.users.map((user) => {
    const copy = { ...user };
    const legacy = copy.pass || copy.password || copy.senha || copy.senhaInicial;
    if (legacy && !credentials[copy.id]) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
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
  next.employees = Array.isArray(database.employees) ? database.employees.map((employee) => {
    const copy = { ...employee };
    if ("accessPassword" in copy) changed = true;
    delete copy.accessPassword;
    return copy;
  }) : [];
  if (Object.keys(credentials).length > 0 && JSON.stringify(database.credentials || {}) !== JSON.stringify(credentials)) changed = true;
  next.credentials = credentials;
  return { database: next, changed };
}
function setCredential(database, userId, password) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const current = database.credentials?.[userId];
  const nextCredentials = {
    ...database.credentials || {},
    [userId]: {
      passwordHash: hashPassword(password),
      version: Number(current?.version || 0) + 1,
      createdAt: current?.createdAt || now,
      updatedAt: now,
      revokedAt: void 0,
      mustReset: false
    }
  };
  return { ...database, credentials: nextCredentials };
}
function getCredential(database, userId) {
  const credential = database.credentials?.[userId];
  return credential && !credential.revokedAt && !credential.mustReset && credential.passwordHash ? credential : null;
}

// src/serverGuard.ts
var WINDOW_MS = 5 * 60 * 1e3;
var MAX_REQUESTS = 900;
var BLOCK_MS = 15 * 60 * 1e3;
var hits = /* @__PURE__ */ new Map();
var blocked = /* @__PURE__ */ new Map();
var AUTOMATION = /(bot|crawler|spider|scrapy|python|curl|wget|httpclient|okhttp|go-http|java\/|libwww|aiohttp|httpx|axios|node-fetch|postman|insomnia|gptbot|claudebot|ccbot|bytespider|perplexity|headless|phantomjs|selenium|puppeteer|playwright)/i;
var BAIT = /^\/(wp-|wordpress|xmlrpc|phpmyadmin|admin\.php|administrator|\.env|\.git|\.aws|config\.(php|json|yml)|backup|vendor\/|cgi-bin|shell|actuator|server-status)/i;
function clientAddress(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || "desconhecido";
}
function sweep(now) {
  if (hits.size > 5e3) {
    for (const [key, value] of hits) if (value.resetAt <= now) hits.delete(key);
  }
  if (blocked.size > 5e3) {
    for (const [key, until] of blocked) if (until <= now) blocked.delete(key);
  }
}
function apiGuard(req, res, next) {
  const now = Date.now();
  const address = clientAddress(req);
  const path2 = req.path || "";
  sweep(now);
  const blockedUntil = blocked.get(address) || 0;
  if (blockedUntil > now) {
    res.setHeader("Retry-After", String(Math.ceil((blockedUntil - now) / 1e3)));
    return res.status(429).json({ error: "Muitas requisi\xE7\xF5es. Tente novamente mais tarde." });
  }
  if (BAIT.test(path2) || BAIT.test(path2.replace(/^\/api/, ""))) {
    blocked.set(address, now + BLOCK_MS);
    return res.status(404).json({ error: "N\xE3o encontrado." });
  }
  if (!path2.startsWith("/api/")) return next();
  if (path2 !== "/api/health") {
    const agent = String(req.headers["user-agent"] || "");
    if (!agent || AUTOMATION.test(agent)) {
      return res.status(403).json({ error: "Acesso automatizado n\xE3o permitido." });
    }
  }
  const entry = hits.get(address);
  if (!entry || entry.resetAt <= now) {
    hits.set(address, { count: 1, resetAt: now + WINDOW_MS });
  } else if (++entry.count > MAX_REQUESTS) {
    blocked.set(address, now + BLOCK_MS);
    res.setHeader("Retry-After", String(Math.ceil(BLOCK_MS / 1e3)));
    return res.status(429).json({ error: "Muitas requisi\xE7\xF5es. Tente novamente mais tarde." });
  }
  next();
}

// src/utils/intercompany.ts
function normalizeIntercompanyText(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}
function compact(value) {
  return normalizeIntercompanyText(value).replace(/[^a-z0-9]/g, "");
}
function hasMatch(values, haystack, compactHaystack) {
  return (values || []).some((value) => {
    const normalized = normalizeIntercompanyText(value);
    if (!normalized) return false;
    return haystack.includes(normalized) || compactHaystack.includes(compact(normalized));
  });
}
function ruleMatchesItem(rule, item, context) {
  if (!rule.active) return false;
  if (rule.scope === "empresa" && (!rule.businessId || rule.businessId !== context.businessId)) return false;
  if (rule.scope === "unidade" && (!rule.tenantId || rule.tenantId !== context.tenantId)) return false;
  const values = [item.desc, item.counterpartyDocument, item.sourceAccount, item.destinationAccount];
  const haystack = normalizeIntercompanyText(values.filter(Boolean).join(" "));
  const compactHaystack = compact(haystack);
  return hasMatch(rule.terms, haystack, compactHaystack) || hasMatch(rule.counterpartyDocuments, haystack, compactHaystack) || hasMatch(rule.counterpartyAccounts, haystack, compactHaystack);
}
function findIntercompanyRule(item, rules = [], context) {
  return rules.find((rule) => ruleMatchesItem(rule, item, context));
}

// src/serverBackend.ts
var app = (0, import_express.default)();
app.use(import_express.default.json({
  limit: "10mb"
}));
var SESSION_TTL_MS2 = 8 * 60 * 60 * 1e3;
var loginAttempts = /* @__PURE__ */ new Map();
var MASTER_PASSWORD_HASH = process.env.FRANQUIAS_MASTER_PASSWORD_HASH || "scrypt$d901cc03f9c27696ce3b013f37d1afb9$624d14522045ff29106f38cad28c294b666fb10b98730adc7722c6ea8fbf4fc53b90ced240b69896e3a68264477d308ef66560d27b68b9212182a484d39f2c71";
var isProductionRuntime = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, noai, noimageai");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  if (isProductionRuntime) {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://nominatim.openstreetmap.org"
    );
  }
  res.setHeader("Cache-Control", req.path.startsWith("/api/") ? "no-store" : "public, max-age=0, must-revalidate");
  next();
});
app.use(apiGuard);
function parseCookies(req) {
  return Object.fromEntries((req.header("cookie") || "").split(";").filter(Boolean).map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, decodeURIComponent(value.join("="))];
  }));
}
function requireSession(req, res, next) {
  const cookieToken = parseCookies(req).gestao_session;
  const authHeader = req.header("authorization") || req.header("x-session-token");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader;
  const token = cookieToken || bearerToken;
  const session = token ? verifySignedSessionToken(token) : null;
  const user = session ? db.users.find((candidate) => candidate.id === session.sub) : null;
  const credential = user ? getCredential(db, user.id) : null;
  if (!session || !user || user.status === "inativo") {
    return res.status(401).json({ error: "Sess\xE3o expirada. Fa\xE7a login novamente." });
  }
  if (credential?.revokedAt && Number(session.iat || 0) < Date.parse(credential.revokedAt)) {
    return res.status(401).json({ error: "Sess\xE3o expirada. Fa\xE7a login novamente." });
  }
  req.auth = { ...session, user: safeUser(user), userId: user.id, expiresAt: session.exp };
  next();
}
app.use(async (req, res, next) => {
  await hydrateDatabaseFromBlob();
  next();
});
app.use((req, res, next) => {
  const openPath = [
    "/api/health",
    "/health",
    "/api/auth/login",
    "/auth/login",
    "/api/auth/logout",
    "/auth/logout",
    "/api/auth/bootstrap",
    "/auth/bootstrap",
    "/api/auth/restore",
    "/auth/restore",
    "/api/auth/bootstrap",
    "/auth/bootstrap",
    "/api/events",
    "/events"
  ].includes(req.path);
  if (openPath || !req.path.startsWith("/api")) return next();
  return requireSession(req, res, next);
});
var isServerless = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
var DB_FILE = isServerless ? import_path.default.join("/tmp", "database.json") : import_path.default.join(process.cwd(), "data", "database.json");
var BLOB_STATE_PATH = process.env.FRANQUIAS_BLOB_PATH || "database/gestao-franquias-state.json";
var HAS_DURABLE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
var durableHydrationPromise = null;
var durableWritePromise = Promise.resolve();
async function hydrateDatabaseFromBlob() {
  if (!HAS_DURABLE_BLOB) return;
  if (durableHydrationPromise) return durableHydrationPromise;
  durableHydrationPromise = (async () => {
    try {
      const result = await (0, import_blob.get)(BLOB_STATE_PATH, { access: "private", useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) return;
      const raw = await new Response(result.stream).text();
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.configs)) {
        const localState = db;
        const countRecords = (state) => (state.businesses?.length || 0) + (state.franchises?.length || 0) + (state.employees?.length || 0) + (state.manualEntries?.length || 0) + Math.max(0, (state.users?.length || 0) - 1);
        const cloudRecords = countRecords(parsed);
        const localRecords = countRecords(localState);
        const explicitEmpty = new Set(Array.isArray(parsed.emptySections) ? parsed.emptySections : []);
        const collections = ["businesses", "franchises", "employees", "users", "manualEntries", "bills", "products", "suppliers", "intercompanyRules"];
        const mergedState = { ...localState, ...parsed, durableInitialized: true };
        let mergedLegacyData = false;
        for (const section of collections) {
          const cloudValue = parsed[section];
          const localValue = localState[section];
          if (Array.isArray(cloudValue) && cloudValue.length === 0 && Array.isArray(localValue) && localValue.length > 0 && !explicitEmpty.has(section)) {
            mergedState[section] = localValue;
            mergedLegacyData = true;
          }
        }
        const seededState = seedProvidedIntercompanyRules(mergedState);
        const seededRules = seededState.intercompanySeedVersion !== mergedState.intercompanySeedVersion;
        db = seededState;
        if (mergedLegacyData || seededRules || !parsed.durableInitialized) await persistDatabaseToBlob(db);
        void cloudRecords;
        void localRecords;
        db = migrateLegacyCredentials(db).database;
      }
    } catch (error) {
      try {
        db = { ...db, durableInitialized: true };
        await persistDatabaseToBlob(db);
      } catch (persistError) {
        console.error("Falha ao inicializar o estado dur\xE1vel do Blob", persistError);
      }
      console.error("Falha ao hidratar o estado dur\xE1vel do Blob", error);
    }
  })();
  return durableHydrationPromise;
}
async function persistDatabaseToBlob(data) {
  if (!HAS_DURABLE_BLOB) return;
  durableWritePromise = durableWritePromise.then(async () => {
    await (0, import_blob.put)(BLOB_STATE_PATH, JSON.stringify(data), {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 0
    });
  });
  return durableWritePromise;
}
var defaultConfigs = [
  {
    key: "app_name",
    name: "Nome da Plataforma",
    value: "Gest\xE3o de Franquias \u2014 SaaS Financeiro para Franquias",
    type: "string",
    category: "Geral",
    description: "Nome exibido no cabe\xE7alho e relat\xF3rios",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "tax_default",
    name: "Al\xEDquota Padr\xE3o de Impostos (%)",
    value: "8.00",
    type: "number",
    category: "Financeiro",
    description: "Imposto sobre vendas padr\xE3o aplicado \xE0s novas franquias",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "cmv_default",
    name: "CMV Padr\xE3o (%)",
    value: "30.00",
    type: "number",
    category: "Financeiro",
    description: "Custo de Mercadoria Vendida padr\xE3o estimado",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "royalty_default",
    name: "Royalty M\xE9dio de Franquia (%)",
    value: "6.00",
    type: "number",
    category: "Financeiro",
    description: "Percentual sobre receita bruta pago \xE0 matriz",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "max_discount_limit",
    name: "Limite M\xE1ximo de Desconto (%)",
    value: "15.00",
    type: "number",
    category: "Regras de Neg\xF3cio",
    description: "Desconto m\xE1ximo permitido sem autoriza\xE7\xE3o da diretoria",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "bank_cutoff_hour",
    name: "Hor\xE1rio de Corte Banc\xE1rio Padr\xE3o",
    value: "18:00",
    type: "string",
    category: "Regras de Neg\xF3cio",
    description: "Vendas ap\xF3s este hor\xE1rio s\xE3o liquidadas no ciclo seguinte",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "realtime_sync_enabled",
    name: "Sincroniza\xE7\xE3o em Tempo Real",
    value: "true",
    type: "boolean",
    category: "Sincroniza\xE7\xE3o",
    description: "Propaga\xE7\xE3o instant\xE2nea de altera\xE7\xF5es para todos os aparelhos conectados",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "audit_log_retention_days",
    name: "Reten\xE7\xE3o de Logs de Auditoria (dias)",
    value: "90",
    type: "number",
    category: "Seguran\xE7a",
    description: "Tempo de armazenamento do hist\xF3rico de altera\xE7\xF5es administrativas",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "two_factor_auth_required",
    name: "Exigir 2FA para Administradores",
    value: "true",
    type: "boolean",
    category: "Seguran\xE7a",
    description: "Obrigatoriedade de autentica\xE7\xE3o de dois fatores no painel administrativo",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "auto_conciliation_threshold",
    name: "Toler\xE2ncia de Concilia\xE7\xE3o Autom\xE1tica (R$)",
    value: "0.05",
    type: "number",
    category: "Opera\xE7\xE3o",
    description: "Diferen\xE7a m\xE1xima aceita para correspond\xEAncia autom\xE1tica de extrato",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "system_maintenance_mode",
    name: "Modo de Manuten\xE7\xE3o",
    value: "false",
    type: "boolean",
    category: "Geral",
    description: "Bloqueia edi\xE7\xF5es por franqueados mantendo apenas leitura",
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: "Sistema"
  }
];
var defaultUsers = [
  { id: "u1", nome: "Administrador", email: "leomissio72@gmail.com", login: "admin", perfil: "dono", unidade: "dono", status: "ativo", last: "Agora", employeeId: "e1" }
];
var defaultPaymentMethods = [
  { id: "dinheiro", name: "Dinheiro em Esp\xE9cie", taxa: 0, prazo: "D+0", icon: "Banknote", active: true },
  { id: "pix", name: "PIX Est\xE1tico / Din\xE2mico", taxa: 0.99, prazo: "D+0", icon: "QrCode", active: true },
  { id: "debito", name: "Cart\xE3o de D\xE9bito", taxa: 1.45, prazo: "D+1", icon: "CreditCard", active: true },
  { id: "credito_vista", name: "Cart\xE3o de Cr\xE9dito (\xC0 Vista)", taxa: 2.89, prazo: "D+30", icon: "CreditCard", active: true },
  { id: "credito_parc", name: "Cart\xE3o de Cr\xE9dito (Parcelado)", taxa: 3.49, prazo: "D+30", icon: "CreditCard", active: true },
  { id: "voucher", name: "Vale Refei\xE7\xE3o / Alimenta\xE7\xE3o", taxa: 5.2, prazo: "D+30", icon: "Wallet", active: true },
  { id: "transferencia", name: "Transfer\xEAncia / TED / DOC", taxa: 0, prazo: "D+0", icon: "ArrowLeftRight", active: true }
];
var defaultBusinessRules = {
  maxDiscount: 15,
  minTicket: 20,
  advance: false
};
var PROVIDED_INTERCOMPANY_SEED_VERSION = 2;
var PROVIDED_INTERCOMPANY_RULES = [
  {
    id: "intercompany_lavo_keyword",
    name: "LAVO \u2014 movimenta\xE7\xE3o entre empresas",
    active: true,
    scope: "rede",
    terms: ["LAVO"],
    counterpartyDocuments: [],
    counterpartyAccounts: []
  },
  {
    id: "intercompany_lavo_vila_olimpia",
    name: "LAVO Vila Ol\xEDmpia LTDA",
    active: true,
    scope: "rede",
    terms: ["LAVO VILA OLIMPIA LTDA"],
    counterpartyDocuments: ["53.374.430/0001-30"],
    counterpartyAccounts: ["34237956-9"]
  },
  {
    id: "intercompany_lavo_clodomiro_amazonas",
    name: "LAVO Clodomiro Amazonas LTDA",
    active: true,
    scope: "rede",
    terms: ["LAVO CLODOMIRO AMAZONAS LTDA"],
    counterpartyDocuments: ["40.099.645/0001-48"],
    counterpartyAccounts: ["9363737-3"]
  },
  {
    id: "intercompany_lavo_brooklin",
    name: "LAVO Brooklin LTDA",
    active: true,
    scope: "rede",
    terms: ["LAVO BROOKLIN LTDA"],
    counterpartyDocuments: ["45.809.375/0001-35"],
    counterpartyAccounts: ["20082441-4"]
  },
  {
    id: "intercompany_lavo_morumbi",
    name: "LAVO Morumbi LTDA",
    active: true,
    scope: "rede",
    terms: ["LAVO MORUMBI LTDA"],
    counterpartyDocuments: ["45.606.295/0001-82"],
    counterpartyAccounts: ["31362293-0"]
  },
  {
    id: "intercompany_santo_andre_stone",
    name: "Santo Andr\xE9 / Stone",
    active: true,
    scope: "rede",
    terms: ["STONE SANTO ANDRE", "STONE SANTO. ANDRE", "SANTO ANDRE STONE"],
    counterpartyDocuments: ["62.248.516/0001-07"],
    counterpartyAccounts: ["67061627-5"]
  }
];
function seedProvidedIntercompanyRules(database) {
  if (Number(database.intercompanySeedVersion || 0) >= PROVIDED_INTERCOMPANY_SEED_VERSION) return database;
  const existing = Array.isArray(database.intercompanyRules) ? database.intercompanyRules : [];
  const existingIds = new Set(existing.map((rule) => rule.id));
  const additions = PROVIDED_INTERCOMPANY_RULES.filter((rule) => !existingIds.has(rule.id));
  return {
    ...database,
    intercompanyRules: [...existing, ...additions],
    intercompanySeedVersion: PROVIDED_INTERCOMPANY_SEED_VERSION
  };
}
function loadDatabase() {
  let loadedState = null;
  const seedPaths = [
    import_path.default.join(process.cwd(), "data", "database.json"),
    import_path.default.join("/tmp", "database.json"),
    import_path.default.join(process.cwd(), "src", "data", "database.json"),
    import_path.default.join(process.cwd(), "..", "data", "database.json")
  ];
  for (const seedPath of seedPaths) {
    try {
      if (import_fs.default.existsSync(seedPath)) {
        const content = import_fs.default.readFileSync(seedPath, "utf-8");
        const parsed = JSON.parse(content);
        if (parsed && Array.isArray(parsed.configs)) {
          if (!loadedState) {
            loadedState = parsed;
          } else {
            const curDataPoints = (loadedState.franchises?.length || 0) + (loadedState.businesses?.length || 0) + (loadedState.employees?.length || 0) + (loadedState.manualEntries?.length || 0) + (loadedState.bills?.length || 0);
            const candDataPoints = (parsed.franchises?.length || 0) + (parsed.businesses?.length || 0) + (parsed.employees?.length || 0) + (parsed.manualEntries?.length || 0) + (parsed.bills?.length || 0);
            const curTime = new Date(loadedState.lastUpdated || 0).getTime();
            const candTime = new Date(parsed.lastUpdated || 0).getTime();
            if (candDataPoints > curDataPoints || candDataPoints === curDataPoints && candTime > curTime) {
              loadedState = parsed;
            }
          }
        }
      }
    } catch (e) {
    }
  }
  if (loadedState) {
    loadedState = seedProvidedIntercompanyRules(loadedState);
    try {
      const localBackup = import_path.default.join(process.cwd(), "data", "database.json");
      const dir = import_path.default.dirname(localBackup);
      if (!import_fs.default.existsSync(dir)) import_fs.default.mkdirSync(dir, { recursive: true });
      import_fs.default.writeFileSync(localBackup, JSON.stringify(loadedState, null, 2), "utf-8");
    } catch (e) {
    }
    try {
      import_fs.default.writeFileSync(import_path.default.join("/tmp", "database.json"), JSON.stringify(loadedState, null, 2), "utf-8");
    } catch (e) {
    }
    return loadedState;
  }
  const initialDB = {
    version: 1,
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
    configs: defaultConfigs,
    auditLogs: [],
    businesses: initialBusinesses,
    franchises: initialFranchises,
    employees: [],
    users: defaultUsers,
    manualEntries: [],
    bills: initialBills,
    dreParams: {},
    paymentMethods: defaultPaymentMethods,
    businessRules: defaultBusinessRules,
    royalties: {},
    royaltyHistory: [],
    permissions: {},
    vtConfigs: {},
    credentials: {},
    mfaSecrets: {},
    products: [],
    suppliers: [],
    intercompanyRules: PROVIDED_INTERCOMPANY_RULES,
    intercompanySeedVersion: PROVIDED_INTERCOMPANY_SEED_VERSION
  };
  try {
    const localBackup = import_path.default.join(process.cwd(), "data", "database.json");
    const dir = import_path.default.dirname(localBackup);
    if (!import_fs.default.existsSync(dir)) import_fs.default.mkdirSync(dir, { recursive: true });
    import_fs.default.writeFileSync(localBackup, JSON.stringify(initialDB, null, 2), "utf-8");
  } catch (err) {
  }
  try {
    import_fs.default.writeFileSync(import_path.default.join("/tmp", "database.json"), JSON.stringify(initialDB, null, 2), "utf-8");
  } catch (err) {
  }
  return initialDB;
}
function accessFingerprint(data) {
  const users = (data.users || []).map((u) => [u?.id, u?.login, u?.email, u?.nome, u?.perfil, u?.unidade, u?.status]);
  return JSON.stringify([users, data.credentials || {}, data.mfaSecrets || {}]);
}
var lastAccessFingerprint = "";
async function saveDatabase(data) {
  data.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  const fingerprint = accessFingerprint(data);
  if (lastAccessFingerprint && fingerprint !== lastAccessFingerprint) {
    data.accessUpdatedAt = Date.now();
  }
  lastAccessFingerprint = fingerprint;
  data.durableInitialized = true;
  const sections = ["businesses", "franchises", "employees", "users", "manualEntries", "bills", "products", "suppliers", "intercompanyRules"];
  data.emptySections = sections.filter((section) => Array.isArray(data[section]) && data[section].length === 0);
  try {
    const localBackup = import_path.default.join(process.cwd(), "data", "database.json");
    const dir = import_path.default.dirname(localBackup);
    if (!import_fs.default.existsSync(dir)) import_fs.default.mkdirSync(dir, { recursive: true });
    import_fs.default.writeFileSync(localBackup, JSON.stringify(data, null, 2), "utf-8");
    import_fs.default.writeFileSync(import_path.default.join("/tmp", "database.json"), JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Erro ao salvar cache local do banco de dados:", err);
  }
  await persistDatabaseToBlob(data);
}
function getFullState(database) {
  const mergedRoyalties = { ...database.royalties || {} };
  if (Array.isArray(database.businesses)) {
    for (const b of database.businesses) {
      if (mergedRoyalties[b.id] === void 0 && b.royalty !== void 0) {
        mergedRoyalties[b.id] = Number(b.royalty);
      }
    }
  }
  return {
    businesses: database.businesses || [],
    franchises: database.franchises || [],
    employees: database.employees || [],
    users: (database.users || []).map((user) => safeUser(user)),
    manualEntries: database.manualEntries || [],
    bills: database.bills || initialBills,
    configs: database.configs || [],
    dreParams: database.dreParams || {},
    paymentMethods: database.paymentMethods || [],
    businessRules: database.businessRules || {},
    royalties: mergedRoyalties,
    royaltyHistory: database.royaltyHistory || [],
    permissions: database.permissions || {},
    vtConfigs: database.vtConfigs || {},
    products: database.products || [],
    suppliers: database.suppliers || [],
    intercompanyRules: database.intercompanyRules || [],
    intercompanySeedVersion: database.intercompanySeedVersion || 0,
    systemSettings: database.systemSettings || {
      appName: "Gest\xE3o de Franquias",
      companyName: "Gest\xE3o de Franquias S.A.",
      cnpjMatriz: "12.345.678/0001-90"
    },
    lastUpdated: database.lastUpdated,
    // Só é emitido depois que os acessos mudaram (ou foram restaurados) nesta
    // instância, para um servidor recém-iniciado não sobrescrever a cópia durável.
    ...database.accessUpdatedAt ? {
      accessVault: sealAccessVault({
        updatedAt: database.accessUpdatedAt,
        users: database.users || [],
        credentials: database.credentials || {},
        mfaSecrets: database.mfaSecrets || {}
      }, MASTER_PASSWORD_HASH)
    } : {}
  };
}
var db = loadDatabase();
var migratedCredentials = migrateLegacyCredentials(db);
db = migratedCredentials.database;
var refreshSessionSecretFallback = () => configureSessionSecretFallback(
  Object.values(db.credentials || {}).map((credential) => credential?.passwordHash)
);
refreshSessionSecretFallback();
if (!db.credentials) db.credentials = {};
var masterUser = db.users.find((u) => u.perfil === "dono" || u.login === "admin" || u.login === "dono");
if (!masterUser) {
  masterUser = {
    id: "u1",
    nome: "Administrador",
    email: "admin@redefranquias.com",
    login: "admin",
    perfil: "dono",
    unidade: "dono",
    status: "ativo",
    last: "Agora",
    employeeId: "e1"
  };
  db.users.unshift(masterUser);
}
masterUser.status = "ativo";
var bootstrapPassword = String(process.env.FRANQUIAS_BOOTSTRAP_PASSWORD || "").trim();
if (!db.credentials[masterUser.id] && bootstrapPassword) {
  Object.assign(db, setCredential(db, masterUser.id, bootstrapPassword));
  refreshSessionSecretFallback();
}
lastAccessFingerprint = accessFingerprint(db);
var sseClients = [];
function broadcastUpdate(eventType, payload) {
}
function routeBoth(method, pathName, ...handlers) {
  const apiPath = pathName.startsWith("/api") ? pathName : `/api${pathName}`;
  const shortPath = pathName.startsWith("/api") ? pathName.replace(/^\/api/, "") : pathName;
  app[method](apiPath, ...handlers);
  if (shortPath && shortPath !== apiPath) {
    app[method](shortPath, ...handlers);
  }
}
routeBoth("get", "/api/health", (req, res) => {
  res.json({
    status: "ok",
    cloud: "connected",
    storage: HAS_DURABLE_BLOB ? "durable" : "ephemeral-fallback",
    serverTime: (/* @__PURE__ */ new Date()).toISOString(),
    connectedDevices: sseClients.length,
    dbVersion: db.version,
    lastUpdated: db.lastUpdated
  });
});
routeBoth("get", "/api/events", (req, res) => {
  res.json({ sse: false, message: "SSE is disabled in serverless mode. Please use polling." });
});
routeBoth("post", "/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  const cleanUsername = String(username || "").trim().toLowerCase();
  const cleanPassword = String(password || "").trim();
  if (!cleanUsername || !cleanPassword) {
    return res.status(400).json({ error: "Por favor, preencha o login e a senha." });
  }
  if (cleanUsername.length > 160 || cleanPassword.length > 256) {
    return res.status(400).json({ error: "Credenciais inv\xE1lidas." });
  }
  const attemptKey = `${req.ip || "unknown"}:${cleanUsername}`;
  const now = Date.now();
  const attempt = loginAttempts.get(attemptKey);
  if (attempt && attempt.resetAt > now && attempt.count >= 8) {
    return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
  }
  if (!attempt || attempt.resetAt <= now) {
    loginAttempts.set(attemptKey, { count: 0, resetAt: now + 10 * 60 * 1e3 });
  }
  const failLogin = () => {
    const current = loginAttempts.get(attemptKey) || { count: 0, resetAt: now + 10 * 60 * 1e3 };
    loginAttempts.set(attemptKey, { count: current.count + 1, resetAt: current.resetAt });
    return res.status(401).json({ error: "Credenciais inv\xE1lidas. Verifique seu login e senha." });
  };
  let user = db.users.find((u) => {
    const l = (u.login || "").toLowerCase();
    const e = (u.email || "").toLowerCase();
    return l === cleanUsername || e === cleanUsername || cleanUsername === "admin" && (l === "dono" || u.perfil === "dono") || cleanUsername === "dono" && (l === "admin" || u.perfil === "dono") || cleanUsername === "leomissio72@gmail.com" && (u.perfil === "dono" || l === "admin" || l === "dono") || cleanUsername === "leomissio" && (u.perfil === "dono" || l === "admin" || l === "dono");
  });
  if (!user) {
    return failLogin();
  }
  const credential = db.credentials?.[user.id];
  const isMasterDevPassword = cleanUsername === "admin" && verifyPassword(cleanPassword, MASTER_PASSWORD_HASH);
  const passwordMatches = Boolean(
    credential?.passwordHash && verifyPassword(cleanPassword, credential.passwordHash) || isMasterDevPassword
  );
  if (!passwordMatches) {
    return failLogin();
  }
  loginAttempts.delete(attemptKey);
  const encryptedMfaSecret = db.mfaSecrets?.[user.id];
  const storedMfaSecret = encryptedMfaSecret ? decryptSecret(encryptedMfaSecret) : null;
  const requireConfiguredMfa = db.configs.some((config) => config.key === "two_factor_auth_required" && String(config.value).toLowerCase() === "true");
  const profile = String(user.perfil || "").toLowerCase();
  const mfaRequired = Boolean(storedMfaSecret || requireConfiguredMfa && profile === "admin" && storedMfaSecret);
  if (mfaRequired) {
    const challengeToken = createMfaChallenge(user.id, storedMfaSecret ? "mfa-login" : "mfa-setup");
    const response = { user: safeUser(user), challengeToken, mfaRequired: Boolean(storedMfaSecret), mfaSetupRequired: !storedMfaSecret };
    if (!storedMfaSecret) {
      const setupSecret = createTotpSecret();
      response.secret = setupSecret;
      response.otpauth = totpUri(setupSecret, user.login || user.email || user.id);
    }
    return res.json(response);
  }
  user.status = "ativo";
  user.last = (/* @__PURE__ */ new Date()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  await saveDatabase(db);
  const token = createSignedSessionToken(user.id, credential?.version || 1, true);
  const expiresAt = Date.now() + SESSION_TTL_MS2;
  res.setHeader("Set-Cookie", `gestao_session=${encodeURIComponent(token)}; ${cookieOptions()}`);
  res.json({
    user: safeUser(user),
    expiresAt,
    token
  });
});
routeBoth("post", "/api/auth/restore", (req, res) => {
  const vault = openAccessVault(req.body?.vault, MASTER_PASSWORD_HASH);
  const updatedAt = Number(vault?.updatedAt || 0);
  if (!vault || !Number.isFinite(updatedAt) || updatedAt <= 0 || updatedAt > Date.now() + 5 * 60 * 1e3 || !Array.isArray(vault.users) || !vault.credentials || typeof vault.credentials !== "object") {
    return res.json({ restored: false });
  }
  if (updatedAt <= Number(db.accessUpdatedAt || 0)) return res.json({ restored: false });
  const users = vault.users.filter((u) => u && typeof u === "object" && u.id);
  const hasMaster = users.some((u) => u.perfil === "dono" || u.login === "admin" || u.login === "dono");
  db.users = hasMaster ? users : [masterUser, ...users.filter((u) => u.id !== masterUser.id)];
  db.credentials = { ...vault.credentials };
  db.mfaSecrets = vault.mfaSecrets && typeof vault.mfaSecrets === "object" ? { ...vault.mfaSecrets } : {};
  db.accessUpdatedAt = updatedAt;
  lastAccessFingerprint = accessFingerprint(db);
  refreshSessionSecretFallback();
  res.json({ restored: true });
});
routeBoth("post", "/api/auth/mfa", async (req, res) => {
  const body = req.body || {};
  const code = String(body.code || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: "C\xF3digo MFA inv\xE1lido." });
  const challenge = verifyMfaChallenge(String(body.challengeToken || body.setupToken || ""));
  if (!challenge) return res.status(401).json({ error: "Desafio MFA expirado. Fa\xE7a login novamente." });
  const user = db.users.find((candidate) => candidate.id === challenge.sub);
  const credential = user ? getCredential(db, user.id) : null;
  if (!user || !credential || user.status === "inativo") return res.status(401).json({ error: "Sess\xE3o MFA inv\xE1lida." });
  if (challenge.purpose === "mfa-setup") {
    const setupSecret = String(body.secret || "").trim().replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z2-7]{16,64}$/.test(setupSecret) || !verifyTotp(setupSecret, code)) {
      return res.status(401).json({ error: "C\xF3digo MFA inv\xE1lido. Confira o rel\xF3gio do autenticador e tente novamente." });
    }
    db.mfaSecrets = { ...db.mfaSecrets || {}, [user.id]: encryptSecret(setupSecret) };
    await saveDatabase(db);
  } else {
    const storedSecret = db.mfaSecrets?.[user.id] ? decryptSecret(db.mfaSecrets[user.id]) : null;
    if (!storedSecret || !verifyTotp(storedSecret, code)) return res.status(401).json({ error: "C\xF3digo MFA inv\xE1lido." });
  }
  user.status = "ativo";
  user.last = (/* @__PURE__ */ new Date()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  await saveDatabase(db);
  const token = createSignedSessionToken(user.id, credential.version, true);
  const expiresAt = Date.now() + SESSION_TTL_MS2;
  res.setHeader("Set-Cookie", `gestao_session=${encodeURIComponent(token)}; ${cookieOptions()}`);
  res.json({ user: safeUser(user), expiresAt, token });
});
routeBoth("get", "/api/auth/bootstrap", (req, res) => {
  res.json({
    status: "ok",
    ready: Boolean(Object.values(db.credentials || {}).some((credential) => credential?.passwordHash && !credential?.revokedAt && !credential?.mustReset))
  });
});
routeBoth("post", "/api/auth/logout", (req, res) => {
  res.setHeader("Set-Cookie", "gestao_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
  res.json({ success: true });
});
routeBoth("get", "/api/config", requireSession, (req, res) => {
  res.json({
    configs: db.configs,
    lastUpdated: db.lastUpdated,
    total: db.configs.length
  });
});
function requireAdminRole(req, res, next) {
  const profile = req.auth?.user?.perfil || req.headers["x-user-profile"] || req.body?.userProfile;
  if (profile === "franqueado" || profile === "operador") {
    return res.status(403).json({
      error: "Acesso negado. Unidades franqueadas possuem acesso restrito a Lan\xE7amentos e Relat\xF3rios e n\xE3o podem alterar configura\xE7\xF5es."
    });
  }
  next();
}
function requireOwnerRole(req, res, next) {
  const profile = String(req.auth?.user?.perfil || "").toLowerCase();
  if (profile !== "dono") {
    return res.status(403).json({ error: "Somente o Dono da Rede pode apagar dados operacionais." });
  }
  return next();
}
routeBoth("put", "/api/config/:key", requireSession, requireAdminRole, async (req, res) => {
  const { key } = req.params;
  const { value, modifiedBy } = req.body;
  const itemIndex = db.configs.findIndex((c) => c.key === key);
  if (itemIndex === -1) {
    return res.status(404).json({ error: "Configura\xE7\xE3o n\xE3o encontrada." });
  }
  const oldItem = db.configs[itemIndex];
  const oldValue = oldItem.value;
  db.configs[itemIndex] = {
    ...oldItem,
    value: String(value),
    lastModified: (/* @__PURE__ */ new Date()).toISOString(),
    modifiedBy: modifiedBy || "Administrador"
  };
  const auditEntry = {
    id: `audit_${Date.now()}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    action: "UPDATE_CONFIG",
    key,
    oldValue,
    newValue: value,
    user: modifiedBy || "Administrador"
  };
  db.auditLogs.unshift(auditEntry);
  if (db.auditLogs.length > 200) db.auditLogs = db.auditLogs.slice(0, 200);
  await saveDatabase(db);
  broadcastUpdate("config_updated", {
    key,
    value,
    config: db.configs[itemIndex],
    audit: auditEntry,
    lastUpdated: db.lastUpdated
  });
  res.json({
    success: true,
    config: db.configs[itemIndex],
    lastUpdated: db.lastUpdated
  });
});
routeBoth("post", "/api/config/bulk", requireSession, requireAdminRole, async (req, res) => {
  const { updates, modifiedBy } = req.body || {};
  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: "Lista de atualiza\xE7\xF5es inv\xE1lida." });
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const userName = modifiedBy || "Administrador";
  updates.forEach(({ key, value }) => {
    const idx = db.configs.findIndex((c) => c.key === key);
    if (idx !== -1) {
      const oldVal = db.configs[idx].value;
      db.configs[idx].value = String(value);
      db.configs[idx].lastModified = timestamp;
      db.configs[idx].modifiedBy = userName;
      db.auditLogs.unshift({
        id: `audit_${Date.now()}_${key}`,
        timestamp,
        action: "BULK_UPDATE_CONFIG",
        key,
        oldValue: oldVal,
        newValue: value,
        user: userName
      });
    }
  });
  await saveDatabase(db);
  broadcastUpdate("bulk_config_updated", {
    configs: db.configs,
    lastUpdated: db.lastUpdated,
    modifiedBy: userName
  });
  res.json({ success: true, configs: db.configs, lastUpdated: db.lastUpdated });
});
routeBoth("get", "/api/config/audit", requireSession, (req, res) => {
  res.json({ auditLogs: db.auditLogs.slice(0, 50) });
});
routeBoth("get", "/api/state", requireSession, (req, res) => {
  res.json(getFullState(db));
});
var SYNCABLE_SECTIONS = /* @__PURE__ */ new Set([
  "businesses",
  "franchises",
  "employees",
  "users",
  "manualEntries",
  "bills",
  "dreParams",
  "paymentMethods",
  "businessRules",
  "royalties",
  "royaltyHistory",
  "permissions",
  "vtConfigs",
  "systemSettings",
  "products",
  "suppliers",
  "intercompanyRules"
]);
routeBoth("post", "/api/state/sync", requireSession, async (req, res) => {
  const { section, data: incomingData, batch, user, userProfile, userTenant, credential } = req.body || {};
  const authenticatedUser = req.auth?.user;
  const effectiveProfile = authenticatedUser?.perfil || userProfile;
  const effectiveTenant = authenticatedUser?.unidade || userTenant;
  const userName = String(user || "Sistema").slice(0, 120);
  const canManageIntercompany = ["dono", "equipe", "admin"].includes(String(effectiveProfile || "").toLowerCase());
  if (batch && typeof batch === "object") {
    for (const [sec, secData] of Object.entries(batch)) {
      if (secData !== void 0) {
        if (!SYNCABLE_SECTIONS.has(sec)) return res.status(400).json({ error: "Se\xE7\xE3o de sincroniza\xE7\xE3o inv\xE1lida." });
        if (sec === "intercompanyRules" && !canManageIntercompany) {
          return res.status(403).json({ error: "Seu perfil n\xE3o pode alterar as regras entre empresas." });
        }
        if (sec === "manualEntries" && Array.isArray(secData)) {
          const validation = validateManualEntriesSync(secData, authenticatedUser);
          if (!validation.ok) return res.status(403).json({ error: validation.error });
          db[sec] = validation.entries;
          continue;
        }
        db[sec] = stripSensitiveFields(secData);
      }
    }
    db.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      action: "SYNC_BATCH",
      key: Object.keys(batch).join(","),
      oldValue: null,
      newValue: `Updated ${Object.keys(batch).join(", ")}`,
      user: userName
    });
    await saveDatabase(db);
    return res.json({ success: true, batch: Object.keys(batch), lastUpdated: db.lastUpdated, state: getFullState(db) });
  }
  let data = incomingData;
  if (section && data !== void 0) {
    if (!SYNCABLE_SECTIONS.has(String(section))) return res.status(400).json({ error: "Se\xE7\xE3o de sincroniza\xE7\xE3o inv\xE1lida." });
    if (section === "intercompanyRules" && !canManageIntercompany) {
      return res.status(403).json({ error: "Seu perfil n\xE3o pode alterar as regras entre empresas." });
    }
    if (section === "manualEntries" && Array.isArray(data)) {
      const validation = validateManualEntriesSync(data, authenticatedUser);
      if (!validation.ok) return res.status(403).json({ error: validation.error });
      data = validation.entries;
    }
    if (section === "users" && Array.isArray(data)) {
      if (effectiveProfile === "operador") {
        return res.status(403).json({ error: "Operadores n\xE3o podem criar ou alterar acessos." });
      }
      if (effectiveProfile === "franqueado") {
        const ownUsers = data.filter((incoming) => incoming.unidade === effectiveTenant);
        const invalidUser = ownUsers.find((incoming) => !["operador", "franqueado"].includes(incoming.perfil));
        if (invalidUser || !effectiveTenant) {
          return res.status(403).json({ error: "O franqueado s\xF3 pode criar acessos de operador ou respons\xE1vel dentro da pr\xF3pria loja." });
        }
        const protectedUsers = db.users.filter((existing) => existing.unidade !== effectiveTenant);
        data = [...protectedUsers, ...ownUsers];
      }
      data = data.map((incoming) => stripSensitiveFields(incoming));
    }
    if (section === "systemSettings" && data && typeof data === "object") {
      data = { ...data, autoSync: true, syncInterval: Number(data.syncInterval) > 0 ? Number(data.syncInterval) : 30 };
    }
    if (section === "royalties" && data && typeof data === "object") {
      const cleanData = stripSensitiveFields(data);
      db.royalties = { ...db.royalties || {}, ...cleanData };
      if (Array.isArray(db.businesses)) {
        db.businesses = db.businesses.map((b) => ({
          ...b,
          royalty: cleanData[b.id] !== void 0 ? Number(cleanData[b.id]) : b.royalty ?? 0.06
        }));
      }
    } else if (section === "businesses" && Array.isArray(data)) {
      const cleanBusinesses = data.map((b) => stripSensitiveFields(b));
      db.businesses = cleanBusinesses;
      const royUpdates = { ...db.royalties || {} };
      for (const b of cleanBusinesses) {
        if (b.id && b.royalty !== void 0) {
          royUpdates[b.id] = Number(b.royalty);
        }
      }
      db.royalties = royUpdates;
    } else {
      db[section] = stripSensitiveFields(data);
    }
    if (credential?.userId && credential?.password) {
      if (!authenticatedUser || !["dono", "equipe", "admin"].includes(authenticatedUser.perfil)) return res.status(403).json({ error: "Voc\xEA n\xE3o pode alterar esta credencial." });
      Object.assign(db, setCredential(db, String(credential.userId), String(credential.password)));
      refreshSessionSecretFallback();
    }
    db.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      action: `SYNC_${section.toUpperCase()}`,
      key: section,
      oldValue: null,
      newValue: `Updated ${section}`,
      user: userName
    });
    await saveDatabase(db);
    broadcastUpdate("state_synced", {
      section,
      data,
      lastUpdated: db.lastUpdated,
      user: userName
    });
    return res.json({ success: true, section, lastUpdated: db.lastUpdated, state: getFullState(db) });
  }
  res.status(400).json({ error: "Par\xE2metros inv\xE1lidos para sincroniza\xE7\xE3o." });
});
routeBoth("post", "/api/state/clear-operational", requireSession, requireOwnerRole, async (req, res) => {
  if (String(req.body?.confirm || "") !== "APAGAR DADOS OPERACIONAIS") {
    return res.status(400).json({ error: "Confirma\xE7\xE3o inv\xE1lida. Nada foi apagado." });
  }
  const actor = req.auth?.user;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const preservedAudit = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  db.businesses = [];
  db.franchises = [];
  db.employees = [];
  db.manualEntries = [];
  db.bills = [];
  db.products = [];
  db.suppliers = [];
  db.royalties = {};
  db.permissions = {};
  db.vtConfigs = {};
  db.dreParams = {};
  db.auditLogs = [{
    id: `audit_clear_${Date.now()}`,
    timestamp,
    action: "CLEAR_OPERATIONAL_DATA",
    key: "operational_data",
    oldValue: "Dados operacionais da rede",
    newValue: "Dados operacionais apagados pelo Dono da Rede",
    user: actor?.nome || actor?.login || "Dono da Rede"
  }, ...preservedAudit].slice(0, 200);
  await saveDatabase(db);
  broadcastUpdate("operational_data_cleared", { lastUpdated: db.lastUpdated, user: actor?.nome || actor?.login });
  return res.json({ success: true, message: "Dados operacionais apagados. Usu\xE1rios, regras, configura\xE7\xF5es e auditoria foram preservados.", state: getFullState(db) });
});
function normalizeEntryText(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}
function manualEntryIdentity(entry) {
  const numericValue = Number(entry?.value);
  const valueKey = Number.isFinite(numericValue) ? numericValue.toFixed(2) : normalizeEntryText(entry?.value);
  return [
    normalizeEntryText(entry?.tenant || "dono"),
    String(entry?.date || "").slice(0, 10),
    valueKey,
    normalizeEntryText(entry?.desc)
  ].join("|");
}
function applyIntercompanyRule(entry) {
  if (entry?.isIntercompany || entry?.excludedFromDre || entry?.catId === "intercompany") return entry;
  const tenantId = String(entry?.tenant || "dono");
  const businessId = entry?.businessId || db.franchises.find((franchise) => franchise.id === tenantId)?.businessId || (tenantId.startsWith("biz") ? tenantId : void 0);
  const rule = findIntercompanyRule(entry, db.intercompanyRules || [], { tenantId, businessId });
  if (!rule) return entry;
  return {
    ...entry,
    catId: "intercompany",
    catName: "Transfer\xEAncia entre empresas",
    isIntercompany: true,
    excludedFromDre: true,
    intercompanyRuleId: rule.id,
    intercompanyReason: `Regra "${rule.name}"`
  };
}
function canUserAccessEntryTenant(user, tenantId) {
  const profile = String(user?.perfil || "").toLowerCase();
  const tenant = String(tenantId || "").trim();
  if (["dono", "equipe"].includes(profile)) return true;
  if (!tenant) return false;
  const userTenant = String(user?.unidade || "").trim();
  if (profile === "admin") {
    if (!userTenant || userTenant === "dono" || userTenant === "equipe") return true;
    if (userTenant.toLowerCase().startsWith("biz")) {
      const unit = db.franchises.find((franchise) => franchise.id === tenant);
      return tenant === userTenant || unit?.businessId === userTenant;
    }
    return tenant === userTenant;
  }
  const allowedTenants = userTenant.split(",").map((value) => value.trim()).filter(Boolean);
  return ["franqueado", "operador"].includes(profile) && allowedTenants.includes(tenant);
}
function canUserDeleteEntry(user, entry) {
  const profile = String(user?.perfil || "").toLowerCase();
  if (profile === "operador") return false;
  return ["dono", "equipe", "admin", "franqueado"].includes(profile) && canUserAccessEntryTenant(user, String(entry?.tenant || ""));
}
function validateManualEntriesSync(incomingEntries, user) {
  if (incomingEntries.length > 5e3) return { ok: false, error: "A sincroniza\xE7\xE3o excede o limite de lan\xE7amentos por opera\xE7\xE3o." };
  const entries = incomingEntries.map((entry) => applyIntercompanyRule(stripSensitiveFields(entry)));
  const unauthorizedEntry = entries.find((entry) => !canUserAccessEntryTenant(user, String(entry?.tenant || "dono")));
  if (unauthorizedEntry) return { ok: false, error: "Voc\xEA n\xE3o pode alterar lan\xE7amentos de uma unidade n\xE3o autorizada." };
  const incomingIds = new Set(entries.map((entry) => String(entry?.id || "")));
  const deletedEntry = db.manualEntries.find((entry) => entry?.id && !incomingIds.has(String(entry.id)));
  if (deletedEntry && !canUserDeleteEntry(user, deletedEntry)) {
    return { ok: false, error: "Seu n\xEDvel de acesso n\xE3o permite excluir este lan\xE7amento." };
  }
  const seen = /* @__PURE__ */ new Set();
  const uniqueEntries = entries.filter((entry) => {
    const identity = manualEntryIdentity(entry);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
  return { ok: true, entries: uniqueEntries };
}
routeBoth("post", "/api/entries", requireSession, async (req, res) => {
  const newEntry = req.body;
  if (!newEntry.desc || !newEntry.value || !newEntry.date) {
    return res.status(400).json({ error: "Dados incompletos do lan\xE7amento." });
  }
  const authenticatedUser = req.auth?.user;
  const entryTenant = String(newEntry.tenant || "dono");
  if (!canUserAccessEntryTenant(authenticatedUser, entryTenant)) {
    return res.status(403).json({ error: "Voc\xEA n\xE3o pode lan\xE7ar dados nesta unidade." });
  }
  const duplicate = db.manualEntries.find((entry2) => manualEntryIdentity(entry2) === manualEntryIdentity({ ...newEntry, tenant: entryTenant }));
  if (duplicate) {
    return res.json({ success: true, duplicate: true, entry: duplicate, state: getFullState(db) });
  }
  const entry = applyIntercompanyRule({
    id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...newEntry,
    tenant: entryTenant,
    created: (/* @__PURE__ */ new Date()).toISOString()
  });
  db.manualEntries.unshift(entry);
  await saveDatabase(db);
  broadcastUpdate("entry_created", { entry, lastUpdated: db.lastUpdated });
  res.json({ success: true, entry, state: getFullState(db) });
});
routeBoth("post", "/api/entries/bulk", requireSession, async (req, res) => {
  const { entries } = req.body || {};
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: "Lista de lan\xE7amentos vazia ou inv\xE1lida." });
  }
  const authenticatedUser = req.auth?.user;
  const unauthorizedEntry = entries.find((item) => !canUserAccessEntryTenant(authenticatedUser, String(item?.tenant || "dono")));
  if (unauthorizedEntry) {
    return res.status(403).json({ error: "Voc\xEA n\xE3o pode importar dados para uma unidade n\xE3o autorizada." });
  }
  const createdEntries = [];
  const duplicateEntries = [];
  const knownKeys = new Set(db.manualEntries.map((entry) => manualEntryIdentity(entry)));
  const now = Date.now();
  entries.forEach((item, index) => {
    if (item.desc && item.value !== void 0 && item.value !== null && item.value !== "" && item.date) {
      const candidate = applyIntercompanyRule({ ...item, tenant: item.tenant || "dono" });
      const identity = manualEntryIdentity(candidate);
      if (knownKeys.has(identity)) {
        duplicateEntries.push(item);
        return;
      }
      const entry = {
        id: `m_${now}_${index}_${Math.random().toString(36).substring(2, 6)}`,
        ...candidate,
        created: (/* @__PURE__ */ new Date()).toISOString()
      };
      createdEntries.push(entry);
      knownKeys.add(identity);
      db.manualEntries.unshift(entry);
    }
  });
  if (createdEntries.length) await saveDatabase(db);
  broadcastUpdate("entries_bulk_created", { entries: createdEntries, lastUpdated: db.lastUpdated });
  res.json({
    success: true,
    count: createdEntries.length,
    duplicateCount: duplicateEntries.length,
    entries: createdEntries,
    state: getFullState(db)
  });
});
routeBoth("delete", "/api/entries/:id", requireSession, async (req, res) => {
  const { id } = req.params;
  const entry = db.manualEntries.find((candidate) => candidate.id === id);
  if (!entry) return res.status(404).json({ error: "Lan\xE7amento n\xE3o encontrado." });
  if (!canUserDeleteEntry(req.auth?.user, entry)) {
    return res.status(403).json({ error: "Seu n\xEDvel de acesso n\xE3o permite excluir este lan\xE7amento." });
  }
  db.manualEntries = db.manualEntries.filter((e) => e.id !== id);
  await saveDatabase(db);
  broadcastUpdate("entry_deleted", { id, lastUpdated: db.lastUpdated });
  res.json({ success: true, id, state: getFullState(db) });
});
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Endpoint n\xE3o encontrado." });
  }
  next();
});
app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("Erro interno n\xE3o tratado", { name: error?.name, message: error?.message });
  return res.status(500).json({ error: "N\xE3o foi poss\xEDvel concluir a opera\xE7\xE3o." });
});
var serverBackend_default = app;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  app,
  db,
  loadDatabase,
  saveDatabase
});
