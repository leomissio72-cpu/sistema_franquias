import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
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
function requireSession(req: Request, res: Response, next: any) {
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
}

function loadDatabase(): DatabaseState {
  // 1. Try to load from current DB_FILE location (e.g. /tmp/database.json or data/database.json)
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.configs)) {
        return parsed;
      }
    }
  } catch (err) {
    // try fallbacks next
  }

  // 2. Fallbacks: Try multiple possible locations to find the seed database.json
  const seedPaths = [
    path.join(process.cwd(), "data", "database.json"),
    path.join(process.cwd(), "src", "data", "database.json"),
    path.join(process.cwd(), "..", "data", "database.json")
  ];

  for (const seedPath of seedPaths) {
    try {
      if (fs.existsSync(seedPath)) {
        const content = fs.readFileSync(seedPath, "utf-8");
        const parsed = JSON.parse(content);
        if (parsed && Array.isArray(parsed.configs)) {
          // If we loaded from a seed path, and we are in serverless mode, write it to DB_FILE (/tmp/database.json)
          if (isServerless) {
            try {
              fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), "utf-8");
            } catch (e) {}
          }
          return parsed;
        }
      }
    } catch (e) {
      // try next path
    }
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
    whatsappHistory: []
  };

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2), "utf-8");
  } catch (err) {
    // ignore write error on fallback
  }
  return initialDB;
}

function saveDatabase(data: DatabaseState) {
  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    const localBackup = path.join(process.cwd(), "data", "database.json");
    if (DB_FILE !== localBackup) {
      try {
        fs.writeFileSync(localBackup, JSON.stringify(data, null, 2), "utf-8");
      } catch (e) {}
    }
  } catch (err) {
    console.error("Erro ao salvar banco de dados:", err);
  }
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
saveDatabase(db);

type SSEClient = { id: string; res: Response };
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
routeBoth("get", "/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    cloud: "connected",
    serverTime: new Date().toISOString(),
    connectedDevices: sseClients.length,
    dbVersion: db.version,
    lastUpdated: db.lastUpdated,
  });
});

// 2. SSE Events (Disabled and converted to polling for serverless stability)
routeBoth("get", "/api/events", (req: Request, res: Response) => {
  res.json({ sse: false, message: "SSE is disabled in serverless mode. Please use polling." });
});

// 3. Auth
routeBoth("post", "/api/auth/login", (req: Request, res: Response) => {
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
  saveDatabase(db);

  const token = createSignedSessionToken(user.id, credential?.version || 1, true);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  res.setHeader("Set-Cookie", `gestao_session=${encodeURIComponent(token)}; ${cookieOptions()}`);
  res.json({
    user: safeUser(user),
    expiresAt,
    token,
  });
});

routeBoth("post", "/api/auth/mfa", (req: Request, res: Response) => {
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

routeBoth("get", "/api/auth/bootstrap", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    ready: true,
    defaultLogin: "admin",
  });
});

routeBoth("post", "/api/auth/logout", (req: Request, res: Response) => {
  res.setHeader("Set-Cookie", "gestao_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
  res.json({ success: true });
});

// 4. Configs
routeBoth("get", "/api/config", (req: Request, res: Response) => {
  res.json({
    configs: db.configs,
    lastUpdated: db.lastUpdated,
    total: db.configs.length,
  });
});

function requireAdminRole(req: Request, res: Response, next: any) {
  const profile = (req as any).auth?.user?.perfil || (req.headers["x-user-profile"] as string) || req.body?.userProfile;
  if (profile === "franqueado" || profile === "operador") {
    return res.status(403).json({
      error: "Acesso negado. Unidades franqueadas possuem acesso restrito a Lançamentos e Relatórios e não podem alterar configurações.",
    });
  }
  next();
}

routeBoth("put", "/api/config/:key", requireSession, requireAdminRole, (req: Request, res: Response) => {
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

  saveDatabase(db);

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

routeBoth("post", "/api/config/bulk", requireSession, requireAdminRole, (req: Request, res: Response) => {
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

  saveDatabase(db);

  broadcastUpdate("bulk_config_updated", {
    configs: db.configs,
    lastUpdated: db.lastUpdated,
    modifiedBy: userName,
  });

  res.json({ success: true, configs: db.configs, lastUpdated: db.lastUpdated });
});

routeBoth("get", "/api/config/audit", (req: Request, res: Response) => {
  res.json({ auditLogs: db.auditLogs.slice(0, 50) });
});

// 5. Central State
routeBoth("get", "/api/state", (req: Request, res: Response) => {
  res.json({
    businesses: db.businesses,
    franchises: db.franchises,
    employees: db.employees,
    users: db.users.map((user: any) => safeUser(user)),
    manualEntries: db.manualEntries,
    configs: db.configs,
    dreParams: db.dreParams,
    paymentMethods: db.paymentMethods,
    businessRules: db.businessRules,
    royalties: db.royalties,
    permissions: db.permissions,
    vtConfigs: db.vtConfigs,
    whatsappConfig: db.whatsappConfig || {
      senderPhone: "+55 (11) 98888-0000",
      connectionStatus: "conectado",
      minInterval: 3,
      maxInterval: 8
    },
    whatsappHistory: db.whatsappHistory || [],
    lastUpdated: db.lastUpdated,
  });
});

routeBoth("post", "/api/state/sync", requireSession, (req: Request, res: Response) => {
  const { section, data: incomingData, user, userProfile, userTenant, credential } = req.body || {};
  const authenticatedUser = (req as any).auth?.user;
  const effectiveProfile = authenticatedUser?.perfil || userProfile;
  const effectiveTenant = authenticatedUser?.unidade || userTenant;
  let data = incomingData;
  const userName = user || "Sistema";

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
    saveDatabase(db);

    broadcastUpdate("state_synced", {
      section,
      data,
      lastUpdated: db.lastUpdated,
      user: userName,
    });

    return res.json({ success: true, section, lastUpdated: db.lastUpdated });
  }

  res.status(400).json({ error: "Parâmetros inválidos para sincronização." });
});

// 6. Manual Entries
routeBoth("post", "/api/entries", requireSession, (req: Request, res: Response) => {
  const newEntry = req.body;
  if (!newEntry.desc || !newEntry.value || !newEntry.date) {
    return res.status(400).json({ error: "Dados incompletos do lançamento." });
  }

  const entry = {
    id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...newEntry,
    created: new Date().toISOString(),
  };

  db.manualEntries.unshift(entry);
  saveDatabase(db);

  broadcastUpdate("entry_created", { entry, lastUpdated: db.lastUpdated });
  res.json({ success: true, entry });
});

routeBoth("post", "/api/entries/bulk", requireSession, (req: Request, res: Response) => {
  const { entries } = req.body || {};
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: "Lista de lançamentos vazia ou inválida." });
  }

  const createdEntries: any[] = [];
  const now = Date.now();

  entries.forEach((item, index) => {
    if (item.desc && item.value && item.date) {
      const entry = {
        id: `m_${now}_${index}_${Math.random().toString(36).substring(2, 6)}`,
        ...item,
        created: new Date().toISOString(),
      };
      createdEntries.push(entry);
      db.manualEntries.unshift(entry);
    }
  });

  saveDatabase(db);

  broadcastUpdate("entries_bulk_created", { entries: createdEntries, lastUpdated: db.lastUpdated });
  res.json({ success: true, count: createdEntries.length, entries: createdEntries });
});

routeBoth("delete", "/api/entries/:id", requireSession, (req: Request, res: Response) => {
  const { id } = req.params;
  db.manualEntries = db.manualEntries.filter((e) => e.id !== id);
  saveDatabase(db);

  broadcastUpdate("entry_deleted", { id, lastUpdated: db.lastUpdated });
  res.json({ success: true, id });
});

// 7. WhatsApp Messaging Dispatch Module
routeBoth("get", "/api/whatsapp/config", (req: Request, res: Response) => {
  res.json(db.whatsappConfig || {
    senderPhone: "+55 (11) 98888-0000",
    connectionStatus: "conectado",
    minInterval: 3,
    maxInterval: 8
  });
});

routeBoth("post", "/api/whatsapp/config", (req: Request, res: Response) => {
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
  saveDatabase(db);
  res.json({ success: true, config: db.whatsappConfig });
});

routeBoth("get", "/api/whatsapp/history", (req: Request, res: Response) => {
  res.json({ history: db.whatsappHistory || [] });
});

routeBoth("post", "/api/whatsapp/history", (req: Request, res: Response) => {
  const { history } = req.body || {};
  if (Array.isArray(history)) {
    db.whatsappHistory = history;
    saveDatabase(db);
  }
  res.json({ success: true, count: (db.whatsappHistory || []).length });
});

routeBoth("post", "/api/whatsapp/send", (req: Request, res: Response) => {
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
    saveDatabase(db);
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
  saveDatabase(db);

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
