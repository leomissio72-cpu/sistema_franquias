import express, { Request, Response as ExpressResponse } from "express";
import path from "path";
import fs from "fs";
import { get, put } from "@vercel/blob";
import { initialBills, initialBusinesses, initialFranchises } from "./data/initialData.ts";
import { configureSessionSecretFallback, cookieOptions, createMfaChallenge, createSignedSessionToken, createTotpSecret, decryptSecret, encryptSecret, getCredential, hashPassword, migrateLegacyCredentials, safeUser, setCredential, stripSensitiveFields, totpUri, verifyMfaChallenge, verifyPassword, verifySignedSessionToken, verifyTotp } from "./serverSecurity.ts";
import { findIntercompanyRule } from "./utils/intercompany.ts";

const app = express();

app.use(express.json({
  limit: "10mb",
}));

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const isProductionRuntime = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (isProductionRuntime) {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://nominatim.openstreetmap.org",
    );
  }
  res.setHeader("Cache-Control", req.path.startsWith("/api/") ? "no-store" : "public, max-age=0, must-revalidate");
  next();
});

function parseCookies(req: Request) {
  return Object.fromEntries((req.header("cookie") || "").split(";").filter(Boolean).map((part) => { const [key, ...value] = part.trim().split("="); return [key, decodeURIComponent(value.join("="))]; }));
}
function requireSession(req: Request, res: ExpressResponse, next: any) {
  const cookieToken = parseCookies(req).gestao_session;
  const authHeader = req.header("authorization") || req.header("x-session-token");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader;
  const token = cookieToken || bearerToken;
  const session = token ? verifySignedSessionToken(token) : null;
  const user = session ? db.users.find((candidate: any) => candidate.id === session.sub) : null;
  const credential = user ? getCredential(db, user.id) : null;
  if (!session || !user || user.status === "inativo" || (credential && Number(session.cv) !== Number(credential.version))) {
    return res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
  }

  (req as any).auth = { ...session, user: safeUser(user), userId: user.id, expiresAt: session.exp };
  next();
}

app.use(async (req, res, next) => {
  await hydrateDatabaseFromBlob();
  next();
});

app.use((req, res, next) => {
  const openPath = [
    "/api/health", "/health",
    "/api/auth/login", "/auth/login",
    "/api/auth/logout", "/auth/logout",
    "/api/auth/mfa", "/auth/mfa",
    "/api/auth/bootstrap", "/auth/bootstrap",
    "/api/events", "/events",
  ].includes(req.path);
  if (openPath || !req.path.startsWith("/api")) return next();
  return requireSession(req, res, next);
});

// Serverless / Read-only filesystem auto-detection and setup
const isServerless = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const DB_FILE = isServerless ? path.join("/tmp", "database.json") : path.join(process.cwd(), "data", "database.json");
const BLOB_STATE_PATH = process.env.FRANQUIAS_BLOB_PATH || "database/gestao-franquias-state.json";
const HAS_DURABLE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
let durableHydrationPromise: Promise<void> | null = null;
let durableWritePromise: Promise<void> = Promise.resolve();

async function hydrateDatabaseFromBlob() {
  if (!HAS_DURABLE_BLOB) return;
  if (durableHydrationPromise) return durableHydrationPromise;
  durableHydrationPromise = (async () => {
    try {
      const result = await get(BLOB_STATE_PATH, { access: "private", useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) return;
      const raw = await new Response(result.stream).text();
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.configs)) {
        const localState = db;
        const countRecords = (state: DatabaseState) =>
          (state.businesses?.length || 0) +
          (state.franchises?.length || 0) +
          (state.employees?.length || 0) +
          (state.manualEntries?.length || 0) +
          Math.max(0, (state.users?.length || 0) - 1);
        const cloudRecords = countRecords(parsed as DatabaseState);
        const localRecords = countRecords(localState);

        // Um Blob antigo e vazio não pode apagar o estado não vazio já existente.
        // Após esta migração, o marcador permite que uma exclusão intencional para
        // zero seja respeitada nas próximas inicializações.
        const explicitEmpty = new Set<string>(Array.isArray(parsed.emptySections) ? parsed.emptySections : []);
        const collections = ["businesses", "franchises", "employees", "users", "manualEntries", "bills", "products", "suppliers", "intercompanyRules"];
        const mergedState: DatabaseState = { ...localState, ...(parsed as DatabaseState), durableInitialized: true };
        let mergedLegacyData = false;
        for (const section of collections) {
          const cloudValue = (parsed as any)[section];
          const localValue = (localState as any)[section];
          if (Array.isArray(cloudValue) && cloudValue.length === 0 && Array.isArray(localValue) && localValue.length > 0 && !explicitEmpty.has(section)) {
            (mergedState as any)[section] = localValue;
            mergedLegacyData = true;
          }
        }
        const seededState = seedProvidedIntercompanyRules(mergedState);
        const seededRules = seededState.intercompanySeedVersion !== mergedState.intercompanySeedVersion;
        db = seededState;
        if (mergedLegacyData || seededRules || !parsed.durableInitialized) await persistDatabaseToBlob(db);
        void cloudRecords;
        void localRecords;
        db = migrateLegacyCredentials(db).database as DatabaseState;
      }
    } catch (error) {
      // No primeiro uso, cria o estado canônico a partir do banco atual.
      try {
        db = { ...db, durableInitialized: true };
        await persistDatabaseToBlob(db);
      } catch (persistError) {
        console.error("Falha ao inicializar o estado durável do Blob", persistError);
      }
      console.error("Falha ao hidratar o estado durável do Blob", error);
    }
  })();
  return durableHydrationPromise;
}

async function persistDatabaseToBlob(data: DatabaseState) {
  if (!HAS_DURABLE_BLOB) return;
  durableWritePromise = durableWritePromise.then(async () => {
    await put(BLOB_STATE_PATH, JSON.stringify(data), {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
  });
  return durableWritePromise;
}


// Initial default configuration items with metadata
const defaultConfigs = [
  {
    key: "app_name",
    name: "Nome da Plataforma",
    value: "Gestão de Franquias — SaaS Financeiro para Franquias",
    type: "string",
    category: "Geral",
    description: "Nome exibido no cabeçalho e relatórios",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema",
  },
  {
    key: "tax_default",
    name: "Alíquota Padrão de Impostos (%)",
    value: "8.00",
    type: "number",
    category: "Financeiro",
    description: "Imposto sobre vendas padrão aplicado às novas franquias",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema",
  },
  {
    key: "cmv_default",
    name: "CMV Padrão (%)",
    value: "30.00",
    type: "number",
    category: "Financeiro",
    description: "Custo de Mercadoria Vendida padrão estimado",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema",
  },
  {
    key: "royalty_default",
    name: "Royalty Médio de Franquia (%)",
    value: "6.00",
    type: "number",
    category: "Financeiro",
    description: "Percentual sobre receita bruta pago à matriz",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema",
  },
  {
    key: "max_discount_limit",
    name: "Limite Máximo de Desconto (%)",
    value: "15.00",
    type: "number",
    category: "Regras de Negócio",
    description: "Desconto máximo permitido sem autorização da diretoria",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema",
  },
  {
    key: "bank_cutoff_hour",
    name: "Horário de Corte Bancário Padrão",
    value: "18:00",
    type: "string",
    category: "Regras de Negócio",
    description: "Vendas após este horário são liquidadas no ciclo seguinte",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema",
  },
  {
    key: "realtime_sync_enabled",
    name: "Sincronização em Tempo Real",
    value: "true",
    type: "boolean",
    category: "Sincronização",
    description: "Propagação instantânea de alterações para todos os aparelhos conectados",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema",
  },
  {
    key: "audit_log_retention_days",
    name: "Retenção de Logs de Auditoria (dias)",
    value: "90",
    type: "number",
    category: "Segurança",
    description: "Tempo de armazenamento do histórico de alterações administrativas",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema",
  },
  {
    key: "two_factor_auth_required",
    name: "Exigir 2FA para Administradores",
    value: "true",
    type: "boolean",
    category: "Segurança",
    description: "Obrigatoriedade de autenticação de dois fatores no painel administrativo",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema",
  },
  {
    key: "auto_conciliation_threshold",
    name: "Tolerância de Conciliação Automática (R$)",
    value: "0.05",
    type: "number",
    category: "Operação",
    description: "Diferença máxima aceita para correspondência automática de extrato",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema",
  },
  {
    key: "system_maintenance_mode",
    name: "Modo de Manutenção",
    value: "false",
    type: "boolean",
    category: "Geral",
    description: "Bloqueia edições por franqueados mantendo apenas leitura",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema",
  }
];

const defaultBusinesses: any[] = initialBusinesses;
const defaultFranchises: any[] = initialFranchises;
const defaultEmployees: any[] = [];
const defaultUsers = [
  { id: "u1", nome: "Administrador", email: "leomissio72@gmail.com", login: "admin", perfil: "dono", unidade: "dono", status: "ativo", last: "Agora", employeeId: "e1" }
];
const defaultManualEntries: any[] = [];

const defaultPaymentMethods = [
  { id: "dinheiro", name: "Dinheiro em Espécie", taxa: 0.0, prazo: "D+0", icon: "Banknote", active: true },
  { id: "pix", name: "PIX Estático / Dinâmico", taxa: 0.99, prazo: "D+0", icon: "QrCode", active: true },
  { id: "debito", name: "Cartão de Débito", taxa: 1.45, prazo: "D+1", icon: "CreditCard", active: true },
  { id: "credito_vista", name: "Cartão de Crédito (À Vista)", taxa: 2.89, prazo: "D+30", icon: "CreditCard", active: true },
  { id: "credito_parc", name: "Cartão de Crédito (Parcelado)", taxa: 3.49, prazo: "D+30", icon: "CreditCard", active: true },
  { id: "voucher", name: "Vale Refeição / Alimentação", taxa: 5.20, prazo: "D+30", icon: "Wallet", active: true },
  { id: "transferencia", name: "Transferência / TED / DOC", taxa: 0.0, prazo: "D+0", icon: "ArrowLeftRight", active: true }
];

const defaultBusinessRules = {
  maxDiscount: 15,
  minTicket: 20,
  advance: false
};

interface DatabaseState {
  version: number;
  lastUpdated: string;
  configs: any[];
  auditLogs: any[];
  businesses: any[];
  franchises: any[];
  employees: any[];
  users: any[];
  manualEntries: any[];
  bills?: any[];
  dreParams: Record<string, any>;
  paymentMethods: any[];
  businessRules: Record<string, any>;
  royalties: Record<string, number>;
  royaltyHistory?: any[];
  permissions: Record<string, any>;
  vtConfigs: Record<string, any>;
  systemSettings?: any;
  credentials?: Record<string, any>;
  mfaSecrets?: Record<string, string>;
  products?: any[];
  suppliers?: any[];
  intercompanyRules?: any[];
  intercompanySeedVersion?: number;
  emptySections?: string[];
  durableInitialized?: boolean;
}

const PROVIDED_INTERCOMPANY_SEED_VERSION = 2;
const PROVIDED_INTERCOMPANY_RULES = [
  {
    id: "intercompany_lavo_keyword",
    name: "LAVO — movimentação entre empresas",
    active: true,
    scope: "rede",
    terms: ["LAVO"],
    counterpartyDocuments: [],
    counterpartyAccounts: [],
  },
  {
    id: "intercompany_lavo_vila_olimpia",
    name: "LAVO Vila Olímpia LTDA",
    active: true,
    scope: "rede",
    terms: ["LAVO VILA OLIMPIA LTDA"],
    counterpartyDocuments: ["53.374.430/0001-30"],
    counterpartyAccounts: ["34237956-9"],
  },
  {
    id: "intercompany_lavo_clodomiro_amazonas",
    name: "LAVO Clodomiro Amazonas LTDA",
    active: true,
    scope: "rede",
    terms: ["LAVO CLODOMIRO AMAZONAS LTDA"],
    counterpartyDocuments: ["40.099.645/0001-48"],
    counterpartyAccounts: ["9363737-3"],
  },
  {
    id: "intercompany_lavo_brooklin",
    name: "LAVO Brooklin LTDA",
    active: true,
    scope: "rede",
    terms: ["LAVO BROOKLIN LTDA"],
    counterpartyDocuments: ["45.809.375/0001-35"],
    counterpartyAccounts: ["20082441-4"],
  },
  {
    id: "intercompany_lavo_morumbi",
    name: "LAVO Morumbi LTDA",
    active: true,
    scope: "rede",
    terms: ["LAVO MORUMBI LTDA"],
    counterpartyDocuments: ["45.606.295/0001-82"],
    counterpartyAccounts: ["31362293-0"],
  },
  {
    id: "intercompany_santo_andre_stone",
    name: "Santo André / Stone",
    active: true,
    scope: "rede",
    terms: ["STONE SANTO ANDRE", "STONE SANTO. ANDRE", "SANTO ANDRE STONE"],
    counterpartyDocuments: ["62.248.516/0001-07"],
    counterpartyAccounts: ["67061627-5"],
  },
];

function seedProvidedIntercompanyRules(database: DatabaseState): DatabaseState {
  if (Number(database.intercompanySeedVersion || 0) >= PROVIDED_INTERCOMPANY_SEED_VERSION) return database;
  const existing = Array.isArray(database.intercompanyRules) ? database.intercompanyRules : [];
  const existingIds = new Set(existing.map((rule: any) => rule.id));
  const additions = PROVIDED_INTERCOMPANY_RULES.filter((rule) => !existingIds.has(rule.id));
  return {
    ...database,
    intercompanyRules: [...existing, ...additions],
    intercompanySeedVersion: PROVIDED_INTERCOMPANY_SEED_VERSION,
  };
}

function loadDatabase(): DatabaseState {
  let loadedState: DatabaseState | null = null;
  const seedPaths = [
    path.join(process.cwd(), "data", "database.json"),
    path.join("/tmp", "database.json"),
    path.join(process.cwd(), "src", "data", "database.json"),
    path.join(process.cwd(), "..", "data", "database.json")
  ];

  for (const seedPath of seedPaths) {
    try {
      if (fs.existsSync(seedPath)) {
        const content = fs.readFileSync(seedPath, "utf-8");
        const parsed = JSON.parse(content);
        if (parsed && Array.isArray(parsed.configs)) {
          if (!loadedState) {
            loadedState = parsed;
          } else {
            const curDataPoints = (loadedState.franchises?.length || 0) + (loadedState.businesses?.length || 0) + (loadedState.employees?.length || 0);
            const candDataPoints = (parsed.franchises?.length || 0) + (parsed.businesses?.length || 0) + (parsed.employees?.length || 0);
            const curTime = new Date(loadedState.lastUpdated || 0).getTime();
            const candTime = new Date(parsed.lastUpdated || 0).getTime();

            if (candDataPoints > curDataPoints || (candDataPoints === curDataPoints && candTime > curTime)) {
              loadedState = parsed;
            }
          }
        }
      }
    } catch (e) {}
  }

  if (loadedState) {
    loadedState = seedProvidedIntercompanyRules(loadedState);
    try {
      const localBackup = path.join(process.cwd(), "data", "database.json");
      const dir = path.dirname(localBackup);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(localBackup, JSON.stringify(loadedState, null, 2), "utf-8");
    } catch (e) {}
    try {
      fs.writeFileSync(path.join("/tmp", "database.json"), JSON.stringify(loadedState, null, 2), "utf-8");
    } catch (e) {}
    return loadedState;
  }

  const initialDB: DatabaseState = {
    version: 1,
    lastUpdated: new Date().toISOString(),
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
    intercompanySeedVersion: PROVIDED_INTERCOMPANY_SEED_VERSION,
  };

  try {
    const localBackup = path.join(process.cwd(), "data", "database.json");
    const dir = path.dirname(localBackup);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localBackup, JSON.stringify(initialDB, null, 2), "utf-8");
  } catch (err) {}
  try {
    fs.writeFileSync(path.join("/tmp", "database.json"), JSON.stringify(initialDB, null, 2), "utf-8");
  } catch (err) {}

  return initialDB;
}

async function saveDatabase(data: DatabaseState) {
  data.lastUpdated = new Date().toISOString();
  data.durableInitialized = true;
  const sections = ["businesses", "franchises", "employees", "users", "manualEntries", "bills", "products", "suppliers", "intercompanyRules"];
  data.emptySections = sections.filter((section) => Array.isArray((data as any)[section]) && (data as any)[section].length === 0);
  try {
    const localBackup = path.join(process.cwd(), "data", "database.json");
    const dir = path.dirname(localBackup);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localBackup, JSON.stringify(data, null, 2), "utf-8");
    fs.writeFileSync(path.join("/tmp", "database.json"), JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Erro ao salvar cache local do banco de dados:", err);
  }
  await persistDatabaseToBlob(data);
}

function getFullState(database: DatabaseState) {
  const mergedRoyalties: Record<string, number> = { ...(database.royalties || {}) };
  if (Array.isArray(database.businesses)) {
    for (const b of database.businesses) {
      if (mergedRoyalties[b.id] === undefined && b.royalty !== undefined) {
        mergedRoyalties[b.id] = Number(b.royalty);
      }
    }
  }
  return {
    businesses: database.businesses || [],
    franchises: database.franchises || [],
    employees: database.employees || [],
    users: (database.users || []).map((user: any) => safeUser(user)),
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
      appName: "Gestão de Franquias",
      companyName: "Gestão de Franquias S.A.",
      cnpjMatriz: "12.345.678/0001-90",
    },
    lastUpdated: database.lastUpdated,
  };
}

let db = loadDatabase();
const migratedCredentials = migrateLegacyCredentials(db);
db = migratedCredentials.database as DatabaseState;
const refreshSessionSecretFallback = () => configureSessionSecretFallback(
  Object.values(db.credentials || {}).map((credential: any) => credential?.passwordHash),
);
refreshSessionSecretFallback();

// Garantir o usuário master sem criar ou redefinir uma senha fixa no código.
// Em uma instalação nova, a primeira senha deve vir apenas do ambiente privado.
if (!db.credentials) db.credentials = {};
let masterUser = db.users.find((u: any) => u.perfil === "dono" || u.login === "admin" || u.login === "dono");
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
const bootstrapPassword = String(process.env.FRANQUIAS_BOOTSTRAP_PASSWORD || "").trim();
if (!db.credentials[masterUser.id] && bootstrapPassword) {
  Object.assign(db, setCredential(db, masterUser.id, bootstrapPassword));
  refreshSessionSecretFallback();
}

type SSEClient = { id: string; res: ExpressResponse };
let sseClients: SSEClient[] = [];

function broadcastUpdate(eventType: string, payload: any) {
  // SSE disabled for serverless stability. Clients poll every few seconds.
}

// ---------------- API ROUTES ----------------

// Helper to register routes on both /api/path and /path
function routeBoth(method: "get" | "post" | "put" | "delete", pathName: string, ...handlers: any[]) {
  const apiPath = pathName.startsWith("/api") ? pathName : `/api${pathName}`;
  const shortPath = pathName.startsWith("/api") ? pathName.replace(/^\/api/, "") : pathName;
  (app as any)[method](apiPath, ...handlers);
  if (shortPath && shortPath !== apiPath) {
    (app as any)[method](shortPath, ...handlers);
  }
}

// 1. Health check
routeBoth("get", "/api/health", (req: Request, res: ExpressResponse) => {
  res.json({
    status: "ok",
    cloud: "connected",
    storage: HAS_DURABLE_BLOB ? "durable" : "ephemeral-fallback",
    serverTime: new Date().toISOString(),
    connectedDevices: sseClients.length,
    dbVersion: db.version,
    lastUpdated: db.lastUpdated,
  });
});

// 2. SSE Events (Disabled and converted to polling for serverless stability)
routeBoth("get", "/api/events", (req: Request, res: ExpressResponse) => {
  res.json({ sse: false, message: "SSE is disabled in serverless mode. Please use polling." });
});

// 3. Auth
routeBoth("post", "/api/auth/login", async (req: Request, res: ExpressResponse) => {
  const { username, password } = req.body || {};
  const cleanUsername = String(username || "").trim().toLowerCase();
  const cleanPassword = String(password || "").trim();

  if (!cleanUsername || !cleanPassword) {
    return res.status(400).json({ error: "Por favor, preencha o login e a senha." });
  }
  if (cleanUsername.length > 160 || cleanPassword.length > 256) {
    return res.status(400).json({ error: "Credenciais inválidas." });
  }

  const attemptKey = `${req.ip || "unknown"}:${cleanUsername}`;
  const now = Date.now();
  const attempt = loginAttempts.get(attemptKey);
  if (attempt && attempt.resetAt > now && attempt.count >= 8) {
    return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
  }
  if (!attempt || attempt.resetAt <= now) {
    loginAttempts.set(attemptKey, { count: 0, resetAt: now + 10 * 60 * 1000 });
  }
  const failLogin = () => {
    const current = loginAttempts.get(attemptKey) || { count: 0, resetAt: now + 10 * 60 * 1000 };
    loginAttempts.set(attemptKey, { count: current.count + 1, resetAt: current.resetAt });
    return res.status(401).json({ error: "Credenciais inválidas. Verifique seu login e senha." });
  };

  // Localiza usuário por login exato, e-mail ou alias (admin <-> dono)
  let user = db.users.find((u: any) => {
    const l = (u.login || "").toLowerCase();
    const e = (u.email || "").toLowerCase();
    return l === cleanUsername || e === cleanUsername ||
      (cleanUsername === "admin" && (l === "dono" || u.perfil === "dono")) ||
      (cleanUsername === "dono" && (l === "admin" || u.perfil === "dono")) ||
      (cleanUsername === "leomissio72@gmail.com" && (u.perfil === "dono" || l === "admin" || l === "dono")) ||
      (cleanUsername === "leomissio" && (u.perfil === "dono" || l === "admin" || l === "dono"));
  });

  if (!user) {
    return failLogin();
  }

  const credential = db.credentials?.[user.id];
  const passwordMatches = Boolean(credential?.passwordHash && verifyPassword(cleanPassword, credential.passwordHash));

  if (!passwordMatches) {
    return failLogin();
  }

  loginAttempts.delete(attemptKey);
  const encryptedMfaSecret = db.mfaSecrets?.[user.id];
  const storedMfaSecret = encryptedMfaSecret ? decryptSecret(encryptedMfaSecret) : null;
  const requireConfiguredMfa = db.configs.some((config: any) => config.key === "two_factor_auth_required" && String(config.value).toLowerCase() === "true");
  const profile = String(user.perfil || "").toLowerCase();
  const mfaRequired = Boolean(storedMfaSecret || (HAS_DURABLE_BLOB && (profile === "dono" || (requireConfiguredMfa && profile === "admin"))));
  if (mfaRequired) {
    const challengeToken = createMfaChallenge(user.id, storedMfaSecret ? "mfa-login" : "mfa-setup");
    const response: any = { user: safeUser(user), challengeToken, mfaRequired: Boolean(storedMfaSecret), mfaSetupRequired: !storedMfaSecret };
    if (!storedMfaSecret) {
      const setupSecret = createTotpSecret();
      response.secret = setupSecret;
      response.otpauth = totpUri(setupSecret, user.login || user.email || user.id);
    }
    return res.json(response);
  }

  user.status = "ativo";
  user.last = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  await saveDatabase(db);

  const token = createSignedSessionToken(user.id, credential?.version || 1, true);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  res.setHeader("Set-Cookie", `gestao_session=${encodeURIComponent(token)}; ${cookieOptions()}`);
  res.json({
    user: safeUser(user),
    expiresAt,
    token,
  });
});

routeBoth("post", "/api/auth/mfa", async (req: Request, res: ExpressResponse) => {
  const body = req.body || {};
  const code = String(body.code || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: "Código MFA inválido." });

  const challenge = verifyMfaChallenge(String(body.challengeToken || body.setupToken || ""));
  if (!challenge) return res.status(401).json({ error: "Desafio MFA expirado. Faça login novamente." });

  const user = db.users.find((candidate: any) => candidate.id === challenge.sub);
  const credential = user ? getCredential(db, user.id) : null;
  if (!user || !credential || user.status === "inativo") return res.status(401).json({ error: "Sessão MFA inválida." });

  if (challenge.purpose === "mfa-setup") {
    const setupSecret = String(body.secret || "").trim().replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z2-7]{16,64}$/.test(setupSecret) || !verifyTotp(setupSecret, code)) {
      return res.status(401).json({ error: "Código MFA inválido. Confira o relógio do autenticador e tente novamente." });
    }
    db.mfaSecrets = { ...(db.mfaSecrets || {}), [user.id]: encryptSecret(setupSecret) };
    await saveDatabase(db);
  } else {
    const storedSecret = db.mfaSecrets?.[user.id] ? decryptSecret(db.mfaSecrets[user.id]) : null;
    if (!storedSecret || !verifyTotp(storedSecret, code)) return res.status(401).json({ error: "Código MFA inválido." });
  }

  user.status = "ativo";
  user.last = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  await saveDatabase(db);
  const token = createSignedSessionToken(user.id, credential.version, true);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  res.setHeader("Set-Cookie", `gestao_session=${encodeURIComponent(token)}; ${cookieOptions()}`);
  res.json({ user: safeUser(user), expiresAt, token });
});

routeBoth("get", "/api/auth/bootstrap", (req: Request, res: ExpressResponse) => {
  res.json({
    status: "ok",
    ready: Boolean(Object.values(db.credentials || {}).some((credential: any) => credential?.passwordHash && !credential?.revokedAt && !credential?.mustReset)),
  });
});

routeBoth("post", "/api/auth/logout", (req: Request, res: ExpressResponse) => {
  res.setHeader("Set-Cookie", "gestao_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
  res.json({ success: true });
});

// 4. Configs
routeBoth("get", "/api/config", requireSession, (req: Request, res: ExpressResponse) => {
  res.json({
    configs: db.configs,
    lastUpdated: db.lastUpdated,
    total: db.configs.length,
  });
});

function requireAdminRole(req: Request, res: ExpressResponse, next: any) {
  const profile = (req as any).auth?.user?.perfil || (req.headers["x-user-profile"] as string) || req.body?.userProfile;
  if (profile === "franqueado" || profile === "operador") {
    return res.status(403).json({
      error: "Acesso negado. Unidades franqueadas possuem acesso restrito a Lançamentos e Relatórios e não podem alterar configurações.",
    });
  }
  next();
}

function requireOwnerRole(req: Request, res: ExpressResponse, next: any) {
  const profile = String((req as any).auth?.user?.perfil || "").toLowerCase();
  if (profile !== "dono") {
    return res.status(403).json({ error: "Somente o Dono da Rede pode apagar dados operacionais." });
  }
  return next();
}

routeBoth("put", "/api/config/:key", requireSession, requireAdminRole, async (req: Request, res: ExpressResponse) => {
  const { key } = req.params;
  const { value, modifiedBy } = req.body;

  const itemIndex = db.configs.findIndex((c) => c.key === key);
  if (itemIndex === -1) {
    return res.status(404).json({ error: "Configuração não encontrada." });
  }

  const oldItem = db.configs[itemIndex];
  const oldValue = oldItem.value;

  db.configs[itemIndex] = {
    ...oldItem,
    value: String(value),
    lastModified: new Date().toISOString(),
    modifiedBy: modifiedBy || "Administrador",
  };

  const auditEntry = {
    id: `audit_${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: "UPDATE_CONFIG",
    key,
    oldValue,
    newValue: value,
    user: modifiedBy || "Administrador",
  };
  db.auditLogs.unshift(auditEntry);
  if (db.auditLogs.length > 200) db.auditLogs = db.auditLogs.slice(0, 200);

  await saveDatabase(db);

  broadcastUpdate("config_updated", {
    key,
    value,
    config: db.configs[itemIndex],
    audit: auditEntry,
    lastUpdated: db.lastUpdated,
  });

  res.json({
    success: true,
    config: db.configs[itemIndex],
    lastUpdated: db.lastUpdated,
  });
});

routeBoth("post", "/api/config/bulk", requireSession, requireAdminRole, async (req: Request, res: ExpressResponse) => {
  const { updates, modifiedBy } = req.body || {};
  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: "Lista de atualizações inválida." });
  }

  const timestamp = new Date().toISOString();
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
        user: userName,
      });
    }
  });

  await saveDatabase(db);

  broadcastUpdate("bulk_config_updated", {
    configs: db.configs,
    lastUpdated: db.lastUpdated,
    modifiedBy: userName,
  });

  res.json({ success: true, configs: db.configs, lastUpdated: db.lastUpdated });
});

routeBoth("get", "/api/config/audit", requireSession, (req: Request, res: ExpressResponse) => {
  res.json({ auditLogs: db.auditLogs.slice(0, 50) });
});

// 5. Central State
routeBoth("get", "/api/state", requireSession, (req: Request, res: ExpressResponse) => {
  res.json(getFullState(db));
});

const SYNCABLE_SECTIONS = new Set([
  "businesses", "franchises", "employees", "users", "manualEntries", "bills",
  "dreParams", "paymentMethods", "businessRules", "royalties", "royaltyHistory",
  "permissions", "vtConfigs", "systemSettings", "products", "suppliers", "intercompanyRules",
]);

routeBoth("post", "/api/state/sync", requireSession, async (req: Request, res: ExpressResponse) => {
  const { section, data: incomingData, batch, user, userProfile, userTenant, credential } = req.body || {};
  const authenticatedUser = (req as any).auth?.user;
  const effectiveProfile = authenticatedUser?.perfil || userProfile;
  const effectiveTenant = authenticatedUser?.unidade || userTenant;
  const userName = String(user || "Sistema").slice(0, 120);
  const canManageIntercompany = ["dono", "equipe", "admin"].includes(String(effectiveProfile || "").toLowerCase());

  if (batch && typeof batch === "object") {
    for (const [sec, secData] of Object.entries(batch)) {
      if (secData !== undefined) {
        if (!SYNCABLE_SECTIONS.has(sec)) return res.status(400).json({ error: "Seção de sincronização inválida." });
        if (sec === "intercompanyRules" && !canManageIntercompany) {
          return res.status(403).json({ error: "Seu perfil não pode alterar as regras entre empresas." });
        }
        if (sec === "manualEntries" && Array.isArray(secData)) {
          const validation = validateManualEntriesSync(secData, authenticatedUser);
          if (!validation.ok) return res.status(403).json({ error: validation.error });
          (db as any)[sec] = validation.entries;
          continue;
        }
        (db as any)[sec] = stripSensitiveFields(secData);
      }
    }
    db.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "SYNC_BATCH",
      key: Object.keys(batch).join(","),
      oldValue: null,
      newValue: `Updated ${Object.keys(batch).join(", ")}`,
      user: userName,
    });
    await saveDatabase(db);
    return res.json({ success: true, batch: Object.keys(batch), lastUpdated: db.lastUpdated, state: getFullState(db) });
  }

  let data = incomingData;
  if (section && data !== undefined) {
    if (!SYNCABLE_SECTIONS.has(String(section))) return res.status(400).json({ error: "Seção de sincronização inválida." });
    if (section === "intercompanyRules" && !canManageIntercompany) {
      return res.status(403).json({ error: "Seu perfil não pode alterar as regras entre empresas." });
    }
    if (section === "manualEntries" && Array.isArray(data)) {
      const validation = validateManualEntriesSync(data, authenticatedUser);
      if (!validation.ok) return res.status(403).json({ error: validation.error });
      data = validation.entries;
    }
    if (section === "users" && Array.isArray(data)) {
      if (effectiveProfile === "operador") {
        return res.status(403).json({ error: "Operadores não podem criar ou alterar acessos." });
      }
      if (effectiveProfile === "franqueado") {
        const ownUsers = data.filter((incoming: any) => incoming.unidade === effectiveTenant);
        const invalidUser = ownUsers.find((incoming: any) => !["operador", "franqueado"].includes(incoming.perfil));
        if (invalidUser || !effectiveTenant) {
          return res.status(403).json({ error: "O franqueado só pode criar acessos de operador ou responsável dentro da própria loja." });
        }
        const protectedUsers = db.users.filter((existing: any) => existing.unidade !== effectiveTenant);
        data = [...protectedUsers, ...ownUsers];
      }
      data = data.map((incoming: any) => stripSensitiveFields(incoming));
    }
    if (section === "systemSettings" && data && typeof data === "object") {
      data = { ...data, autoSync: true, syncInterval: Number(data.syncInterval) > 0 ? Number(data.syncInterval) : 30 };
    }
    if (section === "royalties" && data && typeof data === "object") {
      const cleanData = stripSensitiveFields(data);
      db.royalties = { ...(db.royalties || {}), ...cleanData };
      if (Array.isArray(db.businesses)) {
        db.businesses = db.businesses.map((b: any) => ({
          ...b,
          royalty: cleanData[b.id] !== undefined ? Number(cleanData[b.id]) : (b.royalty ?? 0.06),
        }));
      }
    } else if (section === "businesses" && Array.isArray(data)) {
      const cleanBusinesses = data.map((b: any) => stripSensitiveFields(b));
      db.businesses = cleanBusinesses;
      const royUpdates: Record<string, number> = { ...(db.royalties || {}) };
      for (const b of cleanBusinesses) {
        if (b.id && b.royalty !== undefined) {
          royUpdates[b.id] = Number(b.royalty);
        }
      }
      db.royalties = royUpdates;
    } else {
      (db as any)[section] = stripSensitiveFields(data);
    }
    if (credential?.userId && credential?.password) {
      if (!authenticatedUser || !["dono", "equipe", "admin"].includes(authenticatedUser.perfil)) return res.status(403).json({ error: "Você não pode alterar esta credencial." });
      Object.assign(db, setCredential(db, String(credential.userId), String(credential.password)));
      refreshSessionSecretFallback();
    }
    db.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: `SYNC_${section.toUpperCase()}`,
      key: section,
      oldValue: null,
      newValue: `Updated ${section}`,
      user: userName,
    });
    await saveDatabase(db);

    broadcastUpdate("state_synced", {
      section,
      data,
      lastUpdated: db.lastUpdated,
      user: userName,
    });

    return res.json({ success: true, section, lastUpdated: db.lastUpdated, state: getFullState(db) });
  }

  res.status(400).json({ error: "Parâmetros inválidos para sincronização." });
});

routeBoth("post", "/api/state/clear-operational", requireSession, requireOwnerRole, async (req: Request, res: ExpressResponse) => {
  if (String(req.body?.confirm || "") !== "APAGAR DADOS OPERACIONAIS") {
    return res.status(400).json({ error: "Confirmação inválida. Nada foi apagado." });
  }

  const actor = (req as any).auth?.user;
  const timestamp = new Date().toISOString();
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
    user: actor?.nome || actor?.login || "Dono da Rede",
  }, ...preservedAudit].slice(0, 200);
  await saveDatabase(db);
  broadcastUpdate("operational_data_cleared", { lastUpdated: db.lastUpdated, user: actor?.nome || actor?.login });
  return res.json({ success: true, message: "Dados operacionais apagados. Usuários, regras, configurações e auditoria foram preservados.", state: getFullState(db) });
});

// 6. Manual Entries
function normalizeEntryText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function manualEntryIdentity(entry: any): string {
  const numericValue = Number(entry?.value);
  const valueKey = Number.isFinite(numericValue) ? numericValue.toFixed(2) : normalizeEntryText(entry?.value);
  return [
    normalizeEntryText(entry?.tenant || "dono"),
    String(entry?.date || "").slice(0, 10),
    valueKey,
    normalizeEntryText(entry?.desc),
  ].join("|");
}

function applyIntercompanyRule(entry: any): any {
  if (entry?.isIntercompany || entry?.excludedFromDre || entry?.catId === "intercompany") return entry;
  const tenantId = String(entry?.tenant || "dono");
  const businessId = entry?.businessId
    || db.franchises.find((franchise: any) => franchise.id === tenantId)?.businessId
    || (tenantId.startsWith("biz") ? tenantId : undefined);
  const rule = findIntercompanyRule(entry, db.intercompanyRules || [], { tenantId, businessId });
  if (!rule) return entry;
  return {
    ...entry,
    catId: "intercompany",
    catName: "Transferência entre empresas",
    isIntercompany: true,
    excludedFromDre: true,
    intercompanyRuleId: rule.id,
    intercompanyReason: `Regra "${rule.name}"`,
  };
}

function canUserAccessEntryTenant(user: any, tenantId: string): boolean {
  const profile = String(user?.perfil || "").toLowerCase();
  const tenant = String(tenantId || "").trim();
  if (["dono", "equipe"].includes(profile)) return true;
  if (!tenant) return false;
  const userTenant = String(user?.unidade || "").trim();
  if (profile === "admin") {
    if (!userTenant || userTenant === "dono" || userTenant === "equipe") return true;
    if (userTenant.toLowerCase().startsWith("biz")) {
      const unit = db.franchises.find((franchise: any) => franchise.id === tenant);
      return tenant === userTenant || unit?.businessId === userTenant;
    }
    return tenant === userTenant;
  }
  const allowedTenants = userTenant.split(",").map((value) => value.trim()).filter(Boolean);
  return ["franqueado", "operador"].includes(profile) && allowedTenants.includes(tenant);
}

function canUserDeleteEntry(user: any, entry: any): boolean {
  const profile = String(user?.perfil || "").toLowerCase();
  if (profile === "operador") return false;
  return ["dono", "equipe", "admin", "franqueado"].includes(profile)
    && canUserAccessEntryTenant(user, String(entry?.tenant || ""));
}

function validateManualEntriesSync(incomingEntries: any[], user: any): { ok: true; entries: any[] } | { ok: false; error: string } {
  if (incomingEntries.length > 5000) return { ok: false, error: "A sincronização excede o limite de lançamentos por operação." };
  const entries = incomingEntries.map((entry) => applyIntercompanyRule(stripSensitiveFields(entry)));
  const unauthorizedEntry = entries.find((entry: any) => !canUserAccessEntryTenant(user, String(entry?.tenant || "dono")));
  if (unauthorizedEntry) return { ok: false, error: "Você não pode alterar lançamentos de uma unidade não autorizada." };

  const incomingIds = new Set(entries.map((entry: any) => String(entry?.id || "")));
  const deletedEntry = db.manualEntries.find((entry: any) => entry?.id && !incomingIds.has(String(entry.id)));
  if (deletedEntry && !canUserDeleteEntry(user, deletedEntry)) {
    return { ok: false, error: "Seu nível de acesso não permite excluir este lançamento." };
  }

  const seen = new Set<string>();
  const uniqueEntries = entries.filter((entry: any) => {
    const identity = manualEntryIdentity(entry);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
  return { ok: true, entries: uniqueEntries };
}

routeBoth("post", "/api/entries", requireSession, async (req: Request, res: ExpressResponse) => {
  const newEntry = req.body;
  if (!newEntry.desc || !newEntry.value || !newEntry.date) {
    return res.status(400).json({ error: "Dados incompletos do lançamento." });
  }

  const authenticatedUser = (req as any).auth?.user;
  const entryTenant = String(newEntry.tenant || "dono");
  if (!canUserAccessEntryTenant(authenticatedUser, entryTenant)) {
    return res.status(403).json({ error: "Você não pode lançar dados nesta unidade." });
  }

  const duplicate = db.manualEntries.find((entry: any) => manualEntryIdentity(entry) === manualEntryIdentity({ ...newEntry, tenant: entryTenant }));
  if (duplicate) {
    return res.json({ success: true, duplicate: true, entry: duplicate, state: getFullState(db) });
  }

  const entry = applyIntercompanyRule({
    id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...newEntry,
    tenant: entryTenant,
    created: new Date().toISOString(),
  });

  db.manualEntries.unshift(entry);
  await saveDatabase(db);

  broadcastUpdate("entry_created", { entry, lastUpdated: db.lastUpdated });
  res.json({ success: true, entry, state: getFullState(db) });
});

routeBoth("post", "/api/entries/bulk", requireSession, async (req: Request, res: ExpressResponse) => {
  const { entries } = req.body || {};
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: "Lista de lançamentos vazia ou inválida." });
  }

  const authenticatedUser = (req as any).auth?.user;
  const unauthorizedEntry = entries.find((item: any) => !canUserAccessEntryTenant(authenticatedUser, String(item?.tenant || "dono")));
  if (unauthorizedEntry) {
    return res.status(403).json({ error: "Você não pode importar dados para uma unidade não autorizada." });
  }

  const createdEntries: any[] = [];
  const duplicateEntries: any[] = [];
  const knownKeys = new Set(db.manualEntries.map((entry: any) => manualEntryIdentity(entry)));
  const now = Date.now();

  entries.forEach((item, index) => {
    if (item.desc && item.value !== undefined && item.value !== null && item.value !== "" && item.date) {
      const candidate = applyIntercompanyRule({ ...item, tenant: item.tenant || "dono" });
      const identity = manualEntryIdentity(candidate);
      if (knownKeys.has(identity)) {
        duplicateEntries.push(item);
        return;
      }
      const entry = {
        id: `m_${now}_${index}_${Math.random().toString(36).substring(2, 6)}`,
        ...candidate,
        created: new Date().toISOString(),
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
    state: getFullState(db),
  });
});

routeBoth("delete", "/api/entries/:id", requireSession, async (req: Request, res: ExpressResponse) => {
  const { id } = req.params;
  const entry = db.manualEntries.find((candidate: any) => candidate.id === id);
  if (!entry) return res.status(404).json({ error: "Lançamento não encontrado." });
  if (!canUserDeleteEntry((req as any).auth?.user, entry)) {
    return res.status(403).json({ error: "Seu nível de acesso não permite excluir este lançamento." });
  }
  db.manualEntries = db.manualEntries.filter((e) => e.id !== id);
  await saveDatabase(db);

  broadcastUpdate("entry_deleted", { id, lastUpdated: db.lastUpdated });
  res.json({ success: true, id, state: getFullState(db) });
});

// Resilient 404 handler for unmatched API routes
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Endpoint não encontrado." });
  }
  next();
});

app.use((error: any, _req: Request, res: ExpressResponse, next: any) => {
  if (res.headersSent) return next(error);
  console.error("Erro interno não tratado", { name: error?.name, message: error?.message });
  return res.status(500).json({ error: "Não foi possível concluir a operação." });
});

export { app, db, saveDatabase, loadDatabase };
export default app;
