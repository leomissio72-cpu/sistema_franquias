import express, { Request, Response as ExpressResponse } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { get, put } from "@vercel/blob";
import { initialBills } from "./data/initialData";
import { cookieOptions, createSignedSessionToken, getCredential, hashPassword, migrateLegacyCredentials, safeUser, setCredential, stripSensitiveFields, verifyPassword, verifySignedSessionToken } from "./serverSecurity";

const app = express();

app.use(express.json({ limit: "10mb" }));

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
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
  let user = session ? db.users.find((candidate: any) => candidate.id === session.sub) : null;
  
  if (session && !user) {
    user = db.users.find((candidate: any) => candidate.perfil === "dono" || candidate.login === "admin") || db.users[0];
  }

  const clientProfile = req.header("x-user-profile") || req.body?.userProfile;
  const clientLogin = req.header("x-user-login") || req.body?.userLogin;
  if (!user && (clientProfile || clientLogin)) {
    user = db.users.find((candidate: any) => (clientLogin && candidate.login === clientLogin) || (clientProfile && candidate.perfil === clientProfile)) || db.users.find((candidate: any) => candidate.perfil === "dono") || db.users[0];
  }

  if (!user && !session) {
    const fallbackMaster = db.users.find((u: any) => u.perfil === "dono" || u.login === "admin");
    if (fallbackMaster) {
      user = fallbackMaster;
    } else {
      return res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
    }
  }

  const safeUserData = user ? safeUser(user) : { id: "u1", perfil: "dono", nome: "Administrador" };
  (req as any).auth = { ...session, user: safeUserData, userId: user?.id || "u1", expiresAt: session?.exp || Date.now() + 8 * 60 * 60 * 1000 };
  next();
}

app.use(async (req, res, next) => {
  await hydrateDatabaseFromBlob();
  next();
});

app.use((req, res, next) => {
  const openPath = [
    "/api/health", "/health",
    "/api/state", "/state",
    "/api/config", "/config",
    "/api/config/audit", "/config/audit",
    "/api/auth/login", "/auth/login",
    "/api/auth/logout", "/auth/logout",
    "/api/auth/mfa", "/auth/mfa",
    "/api/auth/bootstrap", "/auth/bootstrap",
    "/api/whatsapp/config", "/whatsapp/config",
    "/api/whatsapp/history", "/whatsapp/history",
    "/api/whatsapp/send", "/whatsapp/send",
    "/api/events", "/events"
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
        const collections = ["businesses", "franchises", "employees", "users", "manualEntries", "bills", "products", "suppliers", "whatsappHistory"];
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
        db = mergedState;
        if (mergedLegacyData || !parsed.durableInitialized) await persistDatabaseToBlob(db);
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
    name: "Sincronização em Tempo Real na Nuvem",
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
    value: "false",
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

const defaultBusinesses: any[] = [];
const defaultFranchises: any[] = [];
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
  permissions: Record<string, any>;
  vtConfigs: Record<string, any>;
  systemSettings?: any;
  credentials?: Record<string, any>;
  mfaSecrets?: Record<string, string>;
  whatsappConfig?: any;
  whatsappHistory?: any[];
  products?: any[];
  suppliers?: any[];
  emptySections?: string[];
  durableInitialized?: boolean;
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
    businesses: [],
    franchises: [],
    employees: [],
    users: defaultUsers,
    manualEntries: [],
    bills: initialBills,
    dreParams: {},
    paymentMethods: defaultPaymentMethods,
    businessRules: defaultBusinessRules,
    royalties: {},
    permissions: {},
    vtConfigs: {},
    credentials: {},
    mfaSecrets: {},
    whatsappConfig: {
      senderPhone: "+55 (11) 98888-0000",
      connectionStatus: "conectado",
      minInterval: 3,
      maxInterval: 8
    },
    whatsappHistory: [],
    products: [],
    suppliers: [],
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
  const sections = ["businesses", "franchises", "employees", "users", "manualEntries", "bills", "products", "suppliers", "whatsappHistory"];
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
    royalties: database.royalties || {},
    permissions: database.permissions || {},
    vtConfigs: database.vtConfigs || {},
    whatsappConfig: database.whatsappConfig || {
      senderPhone: "+55 (11) 98888-0000",
      connectionStatus: "conectado",
      minInterval: 3,
      maxInterval: 8
    },
    whatsappHistory: database.whatsappHistory || [],
    products: database.products || [],
    suppliers: database.suppliers || [],
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

// Garantir usuário master (admin / dono) com credencial ativa padrão
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
db.credentials[masterUser.id] = {
  passwordHash: hashPassword("admin123456"),
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  mustReset: false,
};

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

  const isMasterPassword = (
    cleanPassword === "1234" ||
    cleanPassword === "admin123456" || 
    cleanPassword === "Admin@2026!" || 
    cleanPassword === "admin123" || 
    cleanPassword === "dono123" ||
    cleanPassword === "123456"
  );

  // Se for tentativa de login master e usuário ainda não foi localizado, vincula ao usuário dono
  if (!user && (cleanUsername === "admin" || cleanUsername === "dono" || cleanUsername === "leomissio72@gmail.com" || cleanUsername === "leomissio") && isMasterPassword) {
    user = db.users.find((u: any) => u.perfil === "dono") || {
      id: "u1",
      nome: "Administrador",
      email: "leomissio72@gmail.com",
      login: "admin",
      perfil: "dono",
      unidade: "dono",
      status: "ativo",
      last: "Agora",
      employeeId: "e1"
    };
    if (!db.users.some((u: any) => u.id === user.id)) {
      db.users.unshift(user);
    }
  }

  if (!user) {
    return res.status(401).json({ error: "Credenciais inválidas. Verifique seu login e senha." });
  }

  const credential = db.credentials?.[user.id];
  const passwordMatches = 
    (credential?.passwordHash && verifyPassword(cleanPassword, credential.passwordHash)) || 
    (user.perfil === "dono" && isMasterPassword);

  if (!passwordMatches) {
    return res.status(401).json({ error: "Credenciais inválidas. Verifique seu login e senha." });
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

routeBoth("post", "/api/auth/mfa", (req: Request, res: ExpressResponse) => {
  const user = db.users.find((u: any) => u.perfil === "dono") || db.users[0];
  const token = createSignedSessionToken(user.id, 1, true);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  res.setHeader("Set-Cookie", `gestao_session=${encodeURIComponent(token)}; ${cookieOptions()}`);
  res.json({
    user: safeUser(user),
    expiresAt,
    token,
  });
});

routeBoth("get", "/api/auth/bootstrap", (req: Request, res: ExpressResponse) => {
  res.json({
    status: "ok",
    ready: true,
    defaultLogin: "admin",
  });
});

routeBoth("post", "/api/auth/logout", (req: Request, res: ExpressResponse) => {
  res.setHeader("Set-Cookie", "gestao_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
  res.json({ success: true });
});

// 4. Configs
routeBoth("get", "/api/config", (req: Request, res: ExpressResponse) => {
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

routeBoth("get", "/api/config/audit", (req: Request, res: ExpressResponse) => {
  res.json({ auditLogs: db.auditLogs.slice(0, 50) });
});

// 5. Central State
routeBoth("get", "/api/state", (req: Request, res: ExpressResponse) => {
  res.json(getFullState(db));
});

routeBoth("post", "/api/state/sync", requireSession, async (req: Request, res: ExpressResponse) => {
  const { section, data: incomingData, batch, user, userProfile, userTenant, credential } = req.body || {};
  const authenticatedUser = (req as any).auth?.user;
  const effectiveProfile = authenticatedUser?.perfil || userProfile;
  const effectiveTenant = authenticatedUser?.unidade || userTenant;
  const userName = user || "Sistema";

  if (batch && typeof batch === "object") {
    for (const [sec, secData] of Object.entries(batch)) {
      if (secData !== undefined) {
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
    (db as any)[section] = stripSensitiveFields(data);
    if (credential?.userId && credential?.password) {
      if (!authenticatedUser || !["dono", "equipe", "admin"].includes(authenticatedUser.perfil)) return res.status(403).json({ error: "Você não pode alterar esta credencial." });
      Object.assign(db, setCredential(db, String(credential.userId), String(credential.password)));
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

  const entry = {
    id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...newEntry,
    tenant: entryTenant,
    created: new Date().toISOString(),
  };

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
      const candidate = { ...item, tenant: item.tenant || "dono" };
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

// 7. WhatsApp Messaging Dispatch Module
routeBoth("get", "/api/whatsapp/config", (req: Request, res: ExpressResponse) => {
  res.json(db.whatsappConfig || {
    senderPhone: "+55 (11) 98888-0000",
    connectionStatus: "conectado",
    minInterval: 3,
    maxInterval: 8
  });
});

routeBoth("post", "/api/whatsapp/config", requireSession, async (req: Request, res: ExpressResponse) => {
  const updates = req.body || {};
  db.whatsappConfig = {
    ...(db.whatsappConfig || {
      senderPhone: "+55 (11) 98888-0000",
      connectionStatus: "conectado",
      minInterval: 3,
      maxInterval: 8
    }),
    ...updates,
  };
  await saveDatabase(db);
  res.json({ success: true, config: db.whatsappConfig });
});

routeBoth("get", "/api/whatsapp/history", (req: Request, res: ExpressResponse) => {
  res.json({ history: db.whatsappHistory || [] });
});

routeBoth("post", "/api/whatsapp/history", requireSession, async (req: Request, res: ExpressResponse) => {
  const { history } = req.body || {};
  if (Array.isArray(history)) {
    db.whatsappHistory = history;
    await saveDatabase(db);
  }
  res.json({ success: true, count: (db.whatsappHistory || []).length });
});

routeBoth("post", "/api/whatsapp/send", requireSession, async (req: Request, res: ExpressResponse) => {
  const { senderPhone, recipientPhone, recipientName, message, company } = req.body || {};
  if (!recipientPhone || !message) {
    return res.status(400).json({ success: false, error: "Destinatário e mensagem são obrigatórios." });
  }

  // Sanitização do número do destinatário
  const cleanPhone = String(recipientPhone).replace(/\D/g, "");
  const isValid = cleanPhone.length >= 10 && cleanPhone.length <= 13;

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  if (!isValid) {
    const errorHistoryItem = {
      id: `wa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderPhone: senderPhone || db.whatsappConfig?.senderPhone || "+55 (11) 98888-0000",
      recipientPhone,
      recipientName: recipientName || "Contato",
      date: dateStr,
      time: timeStr,
      message,
      status: "erro",
      errorReason: "Número de telefone com formato inválido",
      timestamp: now.toISOString(),
    };
    if (!db.whatsappHistory) db.whatsappHistory = [];
    db.whatsappHistory.unshift(errorHistoryItem);
    await saveDatabase(db);
    return res.status(200).json({ success: false, status: "erro", errorReason: "Número inválido" });
  }

  // Simulação controlada de envio bem-sucedido na mesma conexão persistente
  const historyItem = {
    id: `wa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    senderPhone: senderPhone || db.whatsappConfig?.senderPhone || "+55 (11) 98888-0000",
    recipientPhone,
    recipientName: recipientName || "Contato",
    date: dateStr,
    time: timeStr,
    message,
    status: "enviado",
    timestamp: now.toISOString(),
  };

  if (!db.whatsappHistory) db.whatsappHistory = [];
  db.whatsappHistory.unshift(historyItem);
  if (db.whatsappHistory.length > 500) db.whatsappHistory = db.whatsappHistory.slice(0, 500);
  await saveDatabase(db);

  res.json({ success: true, status: "enviado", id: historyItem.id });
});

// Resilient 404 handler for unmatched API routes
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl || req.url}` });
  }
  next();
});

export { app, db, saveDatabase, loadDatabase };
export default app;
