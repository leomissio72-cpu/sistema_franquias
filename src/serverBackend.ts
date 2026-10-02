import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { cookieOptions, createSignedSessionToken, getCredential, migrateLegacyCredentials, safeUser, setCredential, stripSensitiveFields, verifyPassword, verifySignedSessionToken } from "./serverSecurity";

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
  const token = parseCookies(req).gestao_session;
  const session = token ? verifySignedSessionToken(token) : null;
  const user = session ? db.users.find((candidate: any) => candidate.id === session.sub && candidate.status === "ativo") : null;
  const credential = user ? getCredential(db, user.id) : null;
  if (!session || !user || !credential || credential.version !== session.cv || (user.perfil === "dono" && !session.mfa)) {
    return res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
  }
  (req as any).auth = { ...session, user: safeUser(user), userId: user.id, expiresAt: session.exp };
  next();
}

app.use((req, res, next) => {
  const openPath = ["/api/health", "/health", "/api/auth/login", "/auth/login", "/api/auth/logout", "/auth/logout", "/api/events", "/events"].includes(req.path);
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

const defaultBusinesses = [
  { id: "biz1", name: "Rede Café Prime", brand: "Café Prime", color: "#3c63da", royalty: 0.06 },
  { id: "biz2", name: "Rede Beleza & Co", brand: "Beleza & Co", color: "#6a4ecb", royalty: 0.05 },
  { id: "biz3", name: "Rede EduKids", brand: "EduKids", color: "#118464", royalty: 0.07 }
];

const defaultFranchises = [
  {
    id: "f001", businessId: "biz1", name: "Café Paulista", code: "CP-SP01", resp: "Renata Campos",
    address: "Av. Paulista, 1000 — Bela Vista, São Paulo/SP", city: "São Paulo", region: "Sudeste",
    lat: -23.5613, lng: -46.6565, faturamento: 148320, pendencias: 4, rpDone: 3, status: "green"
  },
  {
    id: "f002", businessId: "biz1", name: "Café Vila Mariana", code: "CP-SP02", resp: "Marcos Silva",
    address: "Rua Vergueiro, 2000 — Vila Mariana, São Paulo/SP", city: "São Paulo", region: "Sudeste",
    lat: -23.5896, lng: -46.6349, faturamento: 132540, pendencias: 5, rpDone: 2, status: "amber"
  },
  {
    id: "f003", businessId: "biz1", name: "Café Curitiba", code: "CP-CTB01", resp: "Paulo Mendes",
    address: "Rua XV de Novembro, 500 — Centro, Curitiba/PR", city: "Curitiba", region: "Sul",
    lat: -25.4284, lng: -49.2733, faturamento: 98000, pendencias: 1, rpDone: 4, status: "green"
  },
  {
    id: "f004", businessId: "biz2", name: "Beleza Copacabana", code: "BC-RJ01", resp: "Juliana Prado",
    address: "Av. Atlântica, 1700 — Copacabana, Rio de Janeiro/RJ", city: "Rio de Janeiro", region: "Sudeste",
    lat: -22.9711, lng: -43.1823, faturamento: 121000, pendencias: 3, rpDone: 3, status: "green"
  },
  {
    id: "f005", businessId: "biz2", name: "Beleza BH Centro", code: "BC-BH01", resp: "Carla Nunes",
    address: "Av. Afonso Pena, 1200 — Centro, Belo Horizonte/MG", city: "Belo Horizonte", region: "Sudeste",
    lat: -19.9245, lng: -43.9352, faturamento: 87500, pendencias: 6, rpDone: 1, status: "amber"
  },
  {
    id: "f006", businessId: "biz2", name: "Beleza Brasília", code: "BC-BSB01", resp: "Ricardo Alves",
    address: "SCS Quadra 3 — Asa Sul, Brasília/DF", city: "Brasília", region: "Centro-Oeste",
    lat: -15.7942, lng: -47.8822, faturamento: 102300, pendencias: 2, rpDone: 3, status: "green"
  },
  {
    id: "f007", businessId: "biz3", name: "EduKids Moema", code: "EK-SP01", resp: "Ana Beatriz Lima",
    address: "Av. Ibirapuera, 3100 — Moema, São Paulo/SP", city: "São Paulo", region: "Sudeste",
    lat: -23.6015, lng: -46.6633, faturamento: 156800, pendencias: 2, rpDone: 5, status: "green"
  },
  {
    id: "f008", businessId: "biz3", name: "EduKids Porto Alegre", code: "EK-POA01", resp: "Felipe Costa",
    address: "Av. Borges de Medeiros, 800 — Centro, Porto Alegre/RS", city: "Porto Alegre", region: "Sul",
    lat: -30.0346, lng: -51.2177, faturamento: 91200, pendencias: 4, rpDone: 2, status: "amber"
  },
  {
    id: "f009", businessId: "biz3", name: "EduKids Salvador", code: "EK-SSA01", resp: "Mariana Souza",
    address: "Av. Sete de Setembro, 600 — Centro, Salvador/BA", city: "Salvador", region: "Nordeste",
    lat: -12.9714, lng: -38.5014, faturamento: 78400, pendencias: 1, rpDone: 4, status: "green"
  }
];

const defaultEmployees = [
  { id: "e1", nome: "Luís Matos", matricula: "0001", cargo: "Diretor Executivo", unidade: "dono", email: "luis@rede.com", vt: false, login: "dono" },
  { id: "e2", nome: "Renata Campos", matricula: "0012", cargo: "Gerente Geral", unidade: "f001", email: "renata@f001.com", vt: true, login: "renata.f001" },
  { id: "e3", nome: "Carlos Eduardo", matricula: "0018", cargo: "Consultor de Vendas", unidade: "f001", email: "carlos@f001.com", vt: true, login: "" },
  { id: "e4", nome: "Mariana Costa", matricula: "0021", cargo: "Recepcionista", unidade: "f001", email: "mariana@f001.com", vt: true, login: "" },
  { id: "e5", nome: "Marcos Silva", matricula: "0030", cargo: "Gerente", unidade: "f002", email: "marcos@f002.com", vt: true, login: "marcos.f002" },
  { id: "e6", nome: "Juliana Prado", matricula: "0044", cargo: "Gerente Franquia", unidade: "f004", email: "juliana@f004.com", vt: true, login: "juliana.f004" },
  { id: "e7", nome: "Ana Beatriz Lima", matricula: "0051", cargo: "Gestora Operacional", unidade: "f007", email: "ana@f007.com", vt: true, login: "ana.f007" }
];

const defaultUsers = [
  { id: "u1", nome: "Administrador", email: "", login: "dono", perfil: "dono", unidade: "dono", status: "ativo", last: "Agora", employeeId: "e1" },
  { id: "u3", nome: "Admin Café Prime", email: "admin@cafeprime.com", login: "admin.cafe", perfil: "admin", unidade: "biz1", status: "ativo", last: "Hoje 08:15", employeeId: "" },
  { id: "u4", nome: "Admin Beleza & Co", email: "admin@beleza.com", login: "admin.beleza", perfil: "admin", unidade: "biz2", status: "ativo", last: "Ontem 17:40", employeeId: "" },
  { id: "u5", nome: "Admin EduKids", email: "admin@edukids.com", login: "admin.edukids", perfil: "admin", unidade: "biz3", status: "ativo", last: "Ontem 16:10", employeeId: "" },
  { id: "u6", nome: "Renata Campos", email: "renata@f001.com", login: "renata.f001", perfil: "franqueado", unidade: "f001", status: "ativo", last: "Hoje 08:40", employeeId: "e2" },
  { id: "u7", nome: "Marcos Silva", email: "marcos@f002.com", login: "marcos.f002", perfil: "franqueado", unidade: "f002", status: "ativo", last: "Ontem 18:22", employeeId: "e5" },
  { id: "u8", nome: "Juliana Prado", email: "juliana@f004.com", login: "juliana.f004", perfil: "franqueado", unidade: "f004", status: "ativo", last: "Ontem 17:05", employeeId: "e6" },
  { id: "u9", nome: "Ana Beatriz Lima", email: "ana@f007.com", login: "ana.f007", perfil: "franqueado", unidade: "f007", status: "ativo", last: "Hoje 07:50", employeeId: "e7" }
];

const defaultManualEntries = [
  {
    id: "m1",
    tenant: "f001",
    type: "entrada",
    date: new Date().toISOString().slice(0, 10),
    value: 3450.00,
    desc: "Venda corporativa — Coffee Break",
    catId: "receita",
    catName: "Receita operacional",
    pay: "pix",
    note: "Contrato mensal faturado",
    created: new Date().toISOString()
  },
  {
    id: "m2",
    tenant: "f001",
    type: "despesa",
    date: new Date().toISOString().slice(0, 10),
    value: 820.50,
    desc: "Manutenção máquina de café expresso",
    catId: "outros",
    catName: "Outros / Tarifas",
    pay: "transferencia",
    note: "Técnico autorizado",
    created: new Date().toISOString()
  }
];

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
  configs: typeof defaultConfigs;
  auditLogs: any[];
  businesses: typeof defaultBusinesses;
  franchises: typeof defaultFranchises;
  employees: typeof defaultEmployees;
  users: typeof defaultUsers;
  manualEntries: typeof defaultManualEntries;
  dreParams: Record<string, any>;
  paymentMethods: typeof defaultPaymentMethods;
  businessRules: typeof defaultBusinessRules;
  royalties: Record<string, number>;
  permissions: Record<string, any>;
  vtConfigs: Record<string, any>;
  systemSettings?: any;
  credentials?: Record<string, any>;
  mfaSecrets?: Record<string, string>;
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
    auditLogs: [
      {
        id: "audit_init_1",
        timestamp: new Date().toISOString(),
        action: "INITIALIZE_DATABASE",
        key: "all",
        oldValue: null,
        newValue: "Nuvem Gestão de Franquias provisionada com sucesso",
        user: "Sistema Central",
      }
    ],
    businesses: defaultBusinesses,
    franchises: defaultFranchises,
    employees: defaultEmployees,
    users: defaultUsers,
    manualEntries: defaultManualEntries,
    dreParams: {
      dono: { impostos: 8, cmv: 30, despesasOperacionais: 15, marketing: 3, investimentos: 2 },
      f001: { impostos: 8, cmv: 28, despesasOperacionais: 14, marketing: 2.5, investimentos: 1.5 },
      f002: { impostos: 8, cmv: 32, despesasOperacionais: 16, marketing: 3, investimentos: 2 },
      f004: { impostos: 6, cmv: 25, despesasOperacionais: 18, marketing: 4, investimentos: 3 }
    },
    paymentMethods: defaultPaymentMethods,
    businessRules: defaultBusinessRules,
    royalties: { biz1: 0.06, biz2: 0.05, biz3: 0.07 },
    permissions: {},
    vtConfigs: {}
    , credentials: {},
    mfaSecrets: {}
  };

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2), "utf-8");
  } catch (err) {
    // ignore write error on fallback
  }
  return initialDB;
}

function removeDemonstrationData(data: DatabaseState): DatabaseState {
  const demoIds = {
    businesses: new Set(["biz1", "biz2", "biz3"]),
    franchises: new Set(["f001", "f002", "f003", "f004", "f005", "f006", "f007", "f008", "f009"]),
    employees: new Set(["e2", "e3", "e4", "e5", "e6", "e7"]),
    users: new Set(["u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9"]),
    manualEntries: new Set(["m1", "m2"]),
  };
  const withoutDemo = (items: any[], ids: Set<string>) => items.filter((item) => !ids.has(item.id));
  return {
    ...data,
    businesses: withoutDemo(data.businesses || [], demoIds.businesses),
    franchises: withoutDemo(data.franchises || [], demoIds.franchises),
    employees: withoutDemo(data.employees || [], demoIds.employees),
    users: withoutDemo(data.users || [], demoIds.users),
    manualEntries: withoutDemo(data.manualEntries || [], demoIds.manualEntries),
    dreParams: Object.fromEntries(Object.entries(data.dreParams || {}).filter(([key]) => !["f001", "f002", "f004"].includes(key))),
    royalties: Object.fromEntries(Object.entries(data.royalties || {}).filter(([key]) => !demoIds.businesses.has(key))),
  };
}

function saveDatabase(data: DatabaseState) {
  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    // Safe write failure fallback (in-memory persistent state holds value anyway)
  }
}

let db = removeDemonstrationData(loadDatabase());
const migratedCredentials = migrateLegacyCredentials(db);
db = migratedCredentials.database as DatabaseState;
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
  const clientKey = String(req.ip || req.header("x-forwarded-for") || "unknown").slice(0, 80);
  const attempt = loginAttempts.get(clientKey);
  if (attempt && attempt.resetAt > Date.now() && attempt.count >= 8) {
    return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
  }
  const user = db.users.find((u: any) => {
    const matches = u.login.toLowerCase() === String(username || "").trim().toLowerCase();
    const credential = db.credentials?.[u.id];
    return matches && verifyPassword(String(password || ""), credential?.passwordHash);
  });

  if (!user) {
    const current = loginAttempts.get(clientKey);
    loginAttempts.set(clientKey, { count: (current?.resetAt || 0) > Date.now() ? (current?.count || 0) + 1 : 1, resetAt: Date.now() + 15 * 60 * 1000 });
    return res.status(401).json({ error: "Credenciais inválidas. Verifique seu login e senha." });
  }

  loginAttempts.delete(clientKey);

  if (user.status !== "ativo") {
    return res.status(403).json({ error: "Acesso inativo. Contate o administrador do sistema." });
  }

  user.last = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  saveDatabase(db);

  const credential = db.credentials?.[user.id];
  if (!credential) return res.status(401).json({ error: "Credencial antiga revogada. Cadastre uma nova senha pelo acesso administrativo." });
  if (user.perfil === "dono") return res.status(401).json({ error: "O acesso master exige ativação do MFA no endpoint principal." });
  const token = createSignedSessionToken(user.id, credential.version, false);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  res.setHeader("Set-Cookie", `gestao_session=${encodeURIComponent(token)}; ${cookieOptions()}`);
  res.json({
    user: safeUser(user),
    expiresAt,
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

// Resilient 404 handler for unmatched API routes
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl || req.url}` });
  }
  next();
});

export { app, db, saveDatabase, loadDatabase };
export default app;
