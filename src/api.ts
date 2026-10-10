import {
  ConfigItem,
  AuditLog,
  Business,
  FranchiseUnit,
  Employee,
  UserAccount,
  ManualEntry,
  DreParams,
  PaymentMethod,
  BusinessRule,
  VTConfig,
  SystemSettings,
  CloudState,
  RegisteredSupplier,
  HomologatedProduct,
  IntercompanyRule,
} from "./types";
import { readFirebaseMirror, writeFirebaseMirror } from "./firebaseState";
import {
  defaultPaymentMethods,
  defaultBusinessRules,
  initialBusinesses,
  initialFranchises,
  initialEmployees,
  initialUsers,
  initialManualEntries,
  initialBills,
  initialConfigs,
} from "./data/initialData";

let currentAuthToken = "";
try {
  currentAuthToken = sessionStorage.getItem("gestao_auth_token") || localStorage.getItem("gestao_auth_token") || "";
  if (!currentAuthToken) {
    const stored = sessionStorage.getItem("gestao_user_session") || localStorage.getItem("gestao_user_session");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.token) currentAuthToken = parsed.token;
    }
  }
} catch {}

export function setAuthToken(token: string) {
  currentAuthToken = token || "";
  try {
    if (token) {
      sessionStorage.setItem("gestao_auth_token", token);
      localStorage.setItem("gestao_auth_token", token);
    } else {
      sessionStorage.removeItem("gestao_auth_token");
      localStorage.removeItem("gestao_auth_token");
    }
  } catch {}
}

export function getAuthToken(): string {
  if (!currentAuthToken) {
    try {
      currentAuthToken = sessionStorage.getItem("gestao_auth_token") || localStorage.getItem("gestao_auth_token") || "";
    } catch {}
  }
  return currentAuthToken;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(options.headers || {});
  
  const token = getAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("x-session-token", token);
  }
  
  // Enviar perfil se houver sessão para garantia em ambientes com restrição de cookies
  try {
    const userSessionRaw = sessionStorage.getItem("gestao_user_session") || localStorage.getItem("gestao_user_session");
    if (userSessionRaw) {
      const parsed = JSON.parse(userSessionRaw);
      if (parsed?.profile && !headers.has("x-user-profile")) {
        headers.set("x-user-profile", parsed.profile);
      }
      if (parsed?.login && !headers.has("x-user-login")) {
        headers.set("x-user-login", parsed.login);
      }
    }
  } catch {}

  try {
    const res = await fetch(url, { ...options, headers, credentials: "include", signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`A operação demorou mais de ${Math.round(timeoutMs / 1000)} segundos. Tente novamente sem recarregar a página.`);
    }
    throw err;
  }
}

async function safeResponseJSON(res: Response, defaultErrorMsg: string): Promise<any> {
  const text = await res.text();
  if (!res.ok) {
    try {
      const parsed = JSON.parse(text);
      throw new Error(parsed.error || defaultErrorMsg);
    } catch (e: any) {
      if (e.message && e.message !== defaultErrorMsg && !e.message.includes("Unexpected token") && !e.message.includes("is not valid JSON")) {
        throw e;
      }
      const cleanText = text.replace(/<[^>]*>/g, "").trim();
      throw new Error(cleanText.slice(0, 150) || defaultErrorMsg);
    }
  }

  if (!text.trim()) {
    throw new Error(`${defaultErrorMsg}: o servidor retornou uma resposta vazia.`);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error("Resposta do servidor inválida. " + defaultErrorMsg);
  }
}

function sanitizeClientValue(value: any): any {
  if (Array.isArray(value)) return value.map(sanitizeClientValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !["pass", "password", "senha", "senhaInicial", "passwordHash", "accessPassword", "access_password", "token", "sessionToken"].includes(key))
    .map(([key, item]) => [key, sanitizeClientValue(item)]));
}

export function sanitizeLegacyClientStorage() {
  try {
    const cached = localStorage.getItem("sofiacfo_cloud_state");
    if (cached) {
      localStorage.setItem("gestaofranquias_cloud_state", JSON.stringify(sanitizeClientValue(JSON.parse(cached))));
      localStorage.removeItem("sofiacfo_cloud_state");
    }
    localStorage.removeItem("sofiacfo_user_session");
  } catch {
    // A ausência de storage não impede o login por cookie HttpOnly.
  }
}

sanitizeLegacyClientStorage();

export async function fetchHealth() {
  try {
    const res = await fetchWithTimeout("/api/health", {}, 2000);
    return await safeResponseJSON(res, "Health check failed");
  } catch (e) {
    return { status: "offline", mode: "local" };
  }
}

function formatCloudState(data: any): CloudState {
  const rawMethods = Array.isArray(data.paymentMethods)
    ? data.paymentMethods
    : data.paymentMethods?.["dono"];
  const safePaymentMethods =
    Array.isArray(rawMethods) && rawMethods.length > 0
      ? rawMethods
      : defaultPaymentMethods;

  const rawRules = data.businessRules?.["dono"] || data.businessRules;
  const safeRules =
    rawRules && typeof rawRules.maxDiscount === "number"
      ? rawRules
      : defaultBusinessRules;

  return {
    ...data,
    cloudConfigs: data.configs || [],
    bills: Array.isArray(data.bills) ? data.bills : initialBills,
    paymentMethods: safePaymentMethods,
    businessRules: safeRules,
    systemSettings: data.systemSettings || {
      appName: "Gestão de Franquias",
      companyName: "Gestão de Franquias S.A.",
      cnpjMatriz: "12.345.678/0001-90",
    },
    intercompanyRules: Array.isArray(data.intercompanyRules) ? data.intercompanyRules : [],
  };
}

function mergeNonEmptyCollections(primary: CloudState, mirror: CloudState | null, preserveSection?: string): CloudState {
  if (!mirror) return primary;
  const merged: any = { ...mirror, ...primary };
  // Preserva cadastros essenciais e entradas operacionais caso a réplica primária retorne vazia
  const coreSetupKeys = ["businesses", "franchises", "manualEntries", "employees", "bills", "products", "suppliers"];
  for (const key of coreSetupKeys) {
    if (key === preserveSection) continue;
    const current = (primary as any)[key];
    const previous = (mirror as any)[key];
    if (Array.isArray(current) && current.length === 0 && Array.isArray(previous) && previous.length > 0) {
      merged[key] = previous;
    } else if (key === "manualEntries") {
      const arrCurrent = Array.isArray(current) ? current : [];
      const arrPrevious = Array.isArray(previous) ? previous : [];
      if (arrPrevious.length > arrCurrent.length) {
        merged[key] = arrPrevious;
      }
    }
  }
  return formatCloudState(merged);
}

function stateTimestamp(state: CloudState | null | undefined): number {
  const timestamp = state?.lastUpdated ? Date.parse(state.lastUpdated) : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergeIntercompanyMigrations(apiState: CloudState, mirror: CloudState | null): CloudState | null {
  if (!mirror) return null;
  const apiVersion = Number(apiState.intercompanySeedVersion || 0);
  const mirrorVersion = Number(mirror.intercompanySeedVersion || 0);
  if (apiVersion <= mirrorVersion) return mirror;
  return formatCloudState({
    ...mirror,
    intercompanyRules: apiState.intercompanyRules || mirror.intercompanyRules || [],
    intercompanySeedVersion: apiVersion,
  });
}

function mirrorHasRecoverableData(state: CloudState | null): boolean {
  if (!state) return false;
  const collectionKeys: Array<keyof CloudState> = [
    "businesses", "franchises", "employees", "manualEntries", "bills", "products", "suppliers",
  ];
  if (collectionKeys.some((key) => Array.isArray(state[key]) && state[key].length > 0)) return true;
  return Boolean(
    (state.dreParams && Object.keys(state.dreParams).length > 0)
    || (state.vtConfigs && Object.keys(state.vtConfigs).length > 0),
  );
}

/**
 * A API é a fonte autoritativa quando acabou de responder uma gravação. O
 * espelho Firebase pode estar alguns milissegundos atrasado em outro aparelho;
 * escolher sempre o espelho fazia exclusões e alterações voltarem à tela.
 */
function chooseAuthoritativeState(apiState: CloudState, mirror: CloudState | null): CloudState {
  if (!mirror) return formatCloudState(apiState);

  const apiHasSetup = (apiState.businesses?.length || 0) > 0 || (apiState.franchises?.length || 0) > 0;
  const mirrorHasSetup = (mirror.businesses?.length || 0) > 0 || (mirror.franchises?.length || 0) > 0;

  // Se a API estiver sem dados cadastrais após um deploy/republicação, mas o espelho tiver dados,
  // preserva os dados do espelho para que o usuário nunca perca suas franquias e marcas.
  if (!apiHasSetup && mirrorHasSetup) {
    const recovered = {
      ...apiState,
      businesses: mirror.businesses || [],
      franchises: mirror.franchises || [],
      manualEntries: (apiState.manualEntries?.length || 0) > 0 ? apiState.manualEntries : (mirror.manualEntries || []),
      bills: (apiState.bills?.length || 0) > 0 ? apiState.bills : (mirror.bills || []),
      employees: (apiState.employees?.length || 0) > 0 ? apiState.employees : (mirror.employees || []),
      products: (apiState.products?.length || 0) > 0 ? apiState.products : (mirror.products || []),
      suppliers: (apiState.suppliers?.length || 0) > 0 ? apiState.suppliers : (mirror.suppliers || []),
    };
    return formatCloudState(recovered);
  }

  if (stateTimestamp(mirror) > stateTimestamp(apiState)) {
    return mergeNonEmptyCollections(formatCloudState(mirror), apiState);
  }
  return mergeNonEmptyCollections(formatCloudState(apiState), mirror);
}

function getLocalFallbackState(): CloudState {
  try {
    const cached = localStorage.getItem("gestaofranquias_cloud_state") || localStorage.getItem("sofiacfo_cloud_state");
    if (cached) {
      const parsed = sanitizeClientValue(JSON.parse(cached));
      const hasRecoverableData = parsed && (
        (Array.isArray(parsed.businesses) && parsed.businesses.length > 0) ||
        (Array.isArray(parsed.franchises) && parsed.franchises.length > 0) ||
        (Array.isArray(parsed.manualEntries) && parsed.manualEntries.length > 0) ||
        (Array.isArray(parsed.employees) && parsed.employees.length > 0)
      );
      if (hasRecoverableData && Array.isArray(parsed.businesses)) {
        return formatCloudState(parsed);
      }
    }
  } catch (e) {}

  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    cloudConfigs: initialConfigs,
    configs: initialConfigs,
    auditLogs: [],
    businesses: initialBusinesses,
    franchises: initialFranchises,
    employees: initialEmployees,
    users: initialUsers,
    manualEntries: initialManualEntries,
    bills: initialBills,
    dreParams: {},
    paymentMethods: defaultPaymentMethods,
    businessRules: defaultBusinessRules,
    royalties: { biz1: 0.06, biz2: 0.05, biz3: 0.07 },
    permissions: {},
    vtConfigs: {},
    systemSettings: {
      appName: "Gestão de Franquias",
      companyName: "Gestão de Franquias S.A.",
      cnpjMatriz: "12.345.678/0001-90",
    },
    intercompanyRules: [],
  };
}

export async function fetchServerState(): Promise<CloudState> {
  try {
    const [mirroredState, health] = await Promise.all([
      readFirebaseMirror(),
      fetchHealth(),
    ]);
    const res = await fetchWithTimeout("/api/state", {}, 15000);
    const data = await safeResponseJSON(res, "Failed to load server state");
    const apiState = formatCloudState(data);
    // Em Vercel sem BLOB_READ_WRITE_TOKEN, a instância pode voltar ao seed após
    // um cold start. O espelho Firestore é a cópia durável criada após cada
    // salvamento e deve prevalecer nesse modo. As gravações confirmadas pelos
    // handlers aguardam a escrita do espelho antes de atualizar a tela, então
    // uma importação nova não é substituída por uma cópia antiga.
    const migratedMirror = mergeIntercompanyMigrations(apiState, mirroredState);
    const state = health?.storage === "ephemeral-fallback" && migratedMirror && mirrorHasRecoverableData(migratedMirror)
      ? formatCloudState(migratedMirror)
      : chooseAuthoritativeState(apiState, mirroredState);
    // O cofre de acessos vem sempre do servidor quando ele tem um; senão,
    // mantém o que já está guardado na cópia durável.
    const accessVault = apiState.accessVault || mirroredState?.accessVault;
    if (accessVault) state.accessVault = accessVault; else delete state.accessVault;

    // Atualiza o espelho de forma assíncrona (não bloqueante) para evitar travamento da tela
    if (!mirroredState || stateTimestamp(state) >= stateTimestamp(mirroredState)) {
      void writeFirebaseMirror(state).catch(() => {});
    }

    try {
      localStorage.setItem("gestaofranquias_cloud_state", JSON.stringify(sanitizeClientValue(state)));
      localStorage.removeItem("sofiacfo_cloud_state");
    } catch (e) {}

    return state;
  } catch (err) {
    try {
      const firebaseState = await readFirebaseMirror();
      if (firebaseState && Array.isArray(firebaseState.businesses) && Array.isArray(firebaseState.franchises)) {
        const recovered = formatCloudState(firebaseState);
        try {
          localStorage.setItem("gestaofranquias_cloud_state", JSON.stringify(sanitizeClientValue(recovered)));
        } catch (e) {}
        return recovered;
      }
    } catch (firebaseError) {
      console.warn("Could not recover state from Firebase mirror:", firebaseError);
    }
    try {
      const fallback = getLocalFallbackState();
      if (fallback && ((fallback.franchises && fallback.franchises.length > 0) || (fallback.businesses && fallback.businesses.length > 0))) {
        return fallback;
      }
    } catch {}
    console.warn("Could not reach /api/state:", err);
    throw err;
  }
}

export async function fetchConfigs(): Promise<{ configs: ConfigItem[]; lastUpdated: string }> {
  const res = await fetchWithTimeout("/api/config");
  return safeResponseJSON(res, "Failed to fetch configs");
}

export async function updateSingleConfig(key: string, value: any, modifiedBy?: string, userId?: string) {
  const res = await fetchWithTimeout(`/api/config/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value, modifiedBy, userId }),
  });
  const result = await safeResponseJSON(res, "Failed to update configuration");
  if (result?.state) await writeFirebaseMirror(formatCloudState(result.state));
  return result;
}

export async function saveCloudConfig(
  key: string,
  value: any,
  category: string,
  label: string,
  modifiedBy: string,
  userId?: string
): Promise<CloudState> {
  await updateSingleConfig(key, value, modifiedBy, userId);
  return fetchServerState();
}

export async function updateBulkConfig(updates: Array<{ key: string; value: any }>, modifiedBy?: string, userId?: string) {
  const res = await fetchWithTimeout("/api/config/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates, modifiedBy, userId }),
  });
  const result = await safeResponseJSON(res, "Failed to bulk update configurations");
  if (result?.state) await writeFirebaseMirror(formatCloudState(result.state));
  return result;
}

export async function fetchAuditLogs(): Promise<{ auditLogs: AuditLog[] }> {
  try {
    const res = await fetchWithTimeout("/api/config/audit", {}, 2500);
    return await safeResponseJSON(res, "Failed to fetch audit logs");
  } catch (e) {
    return { auditLogs: [] };
  }
}

let stateSyncChain: Promise<void> = Promise.resolve();

export async function syncStateSection(section: string, data: any, user?: string, actor?: { profile?: string; tenant?: string; login?: string }, credential?: { userId: string; password: string }): Promise<CloudState> {
  const operation = async (): Promise<CloudState> => {
    const res = await fetchWithTimeout("/api/state/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, data, user, userProfile: actor?.profile, userTenant: actor?.tenant, userLogin: actor?.login, credential }),
    }, 45000);
    if (!res.ok) {
      const err = await safeResponseJSON(res, "Failed to sync state section").catch((e) => e);
      throw new Error(err?.message || err?.error || "Failed to sync state section");
    }
    const result = await safeResponseJSON(res, "Failed to parse sync response");
    if (result?.state) {
      // O backend acabou de confirmar a gravação; não mesclar uma leitura
      // antiga do Firebase por cima da resposta, especialmente em exclusões.
      const state = formatCloudState(result.state);
      await writeFirebaseMirror(state);
      try {
        localStorage.setItem("gestaofranquias_cloud_state", JSON.stringify(sanitizeClientValue(state)));
      } catch (e) {}
      return state;
    }
    return fetchServerState();
  };

  const queuedOperation = stateSyncChain.then(operation, operation);
  stateSyncChain = queuedOperation.then(() => undefined, () => undefined);
  return queuedOperation;
}

export async function saveDreParams(tenantId: string, params: DreParams, userName: string, userId?: string, baseDreParams?: Record<string, DreParams>, actor?: { profile?: string; tenant?: string; login?: string }): Promise<CloudState> {
  const currentDreParams = baseDreParams || (await fetchServerState()).dreParams;
  const updatedDreParams = {
    ...currentDreParams,
    [tenantId]: params,
  };
  return syncStateSection("dreParams", updatedDreParams, userName, actor);
}

export async function savePaymentRules(methods: PaymentMethod[], rules: BusinessRule, userName: string, userId?: string): Promise<CloudState> {
  await syncStateSection("paymentMethods", methods, userName);
  return syncStateSection("businessRules", rules, userName);
}

export async function saveVtConfig(tenantId: string, config: VTConfig, userName: string, userId?: string): Promise<CloudState> {
  const currentState = await fetchServerState();
  const updated = {
    ...currentState.vtConfigs,
    [tenantId]: config,
  };
  return syncStateSection("vtConfigs", updated, userName);
}

export async function saveRoyalties(rates: Record<string, number>, userName: string, userId?: string): Promise<CloudState> {
  return syncStateSection("royalties", rates, userName);
}

export async function saveFranchises(franchises: FranchiseUnit[], userName: string): Promise<CloudState> {
  return syncStateSection("franchises", franchises, userName);
}

export async function saveBusinesses(businesses: Business[], userName: string): Promise<CloudState> {
  return syncStateSection("businesses", businesses, userName);
}

export async function saveSuppliers(suppliers: RegisteredSupplier[], userName: string, actor?: { profile?: string; tenant?: string; login?: string }): Promise<CloudState> {
  return syncStateSection("suppliers", suppliers, userName, actor);
}

export async function saveProducts(products: HomologatedProduct[], userName: string, actor?: { profile?: string; tenant?: string; login?: string }): Promise<CloudState> {
  return syncStateSection("products", products, userName, actor);
}

export async function saveSystemSettings(settings: SystemSettings, userName: string, userId?: string): Promise<CloudState> {
  return syncStateSection("systemSettings", settings, userName);
}

export async function saveIntercompanyRules(rules: IntercompanyRule[], userName: string): Promise<CloudState> {
  return syncStateSection("intercompanyRules", rules, userName);
}

export async function resetDatabase(): Promise<CloudState> {
  const res = await fetchWithTimeout("/api/state/reset", { 
    method: "POST", 
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify({ confirm: "RESETAR_BASE" }) 
  });
  if (!res.ok) throw new Error("Failed to reset database");
  return fetchServerState();
}

export async function clearOperationalData(): Promise<CloudState> {
  const res = await fetchWithTimeout("/api/state/clear-operational", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: "APAGAR DADOS OPERACIONAIS" }),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error || "Não foi possível apagar os dados operacionais.");
  }
  const payload = await safeResponseJSON(res, "Não foi possível ler o estado após a limpeza.");
  const state = formatCloudState(payload?.state || payload);
  await writeFirebaseMirror(state, { allowEmptyReset: true });
  try {
    localStorage.setItem("gestaofranquias_cloud_state", JSON.stringify(sanitizeClientValue(state)));
    localStorage.removeItem("sofiacfo_cloud_state");
  } catch (e) {}
  return state;
}

export async function createManualEntryAPI(entry: Partial<ManualEntry>) {
  const res = await fetchWithTimeout("/api/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  return safeResponseJSON(res, "Failed to create entry");
}

export async function createManualEntriesBulkAPI(entries: Array<Partial<ManualEntry>>) {
  const res = await fetchWithTimeout("/api/entries/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries }),
  });
  return safeResponseJSON(res, "Failed to create bulk entries");
}

function manualEntryIdentity(entry: Pick<ManualEntry, "tenant" | "date" | "value" | "desc">): string {
  const normalizedText = String(entry.desc || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  const numericValue = Number(entry.value);
  const valueKey = Number.isFinite(numericValue) ? numericValue.toFixed(2) : String(entry.value || "");
  return [String(entry.tenant || "dono"), String(entry.date || "").slice(0, 10), valueKey, normalizedText].join("|");
}

async function persistReturnedState(state: CloudState): Promise<CloudState> {
  const formatted = formatCloudState(state);
  await writeFirebaseMirror(formatted);
  try {
    localStorage.setItem("gestaofranquias_cloud_state", JSON.stringify(sanitizeClientValue(formatted)));
  } catch {}
  return formatted;
}

export async function createManualEntry(entry: Partial<ManualEntry>, userName?: string, userId?: string): Promise<CloudState> {
  let backendState: any = null;
  try {
    const result = await createManualEntryAPI(entry);
    if (result?.state) backendState = result.state;
  } catch (err) {
    console.warn("Backend create entry API notice, syncing directly with cloud:", err);
  }

  // A resposta do backend acabou de confirmar a gravação e contém o ID real,
  // as deduplicações e a classificação intercompany. Nunca a substitua por
  // uma leitura possivelmente atrasada do espelho Firebase.
  if (backendState) return persistReturnedState(backendState);

  const currentState = (await readFirebaseMirror()) || getLocalFallbackState();
  const currentEntries = Array.isArray(currentState.manualEntries) ? currentState.manualEntries : [];
  const newEntry: ManualEntry = {
    id: entry.id || `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    tenant: entry.tenant || "dono",
    type: entry.type || "despesa",
    date: entry.date || new Date().toISOString().slice(0, 10),
    value: Number(entry.value) || 0,
    desc: entry.desc || "Lançamento",
    apelido: entry.apelido,
    catId: entry.catId || (entry.type === "entrada" ? "receita" : "outros"),
    catName: entry.catName || "Despesa",
    pay: entry.pay || "pix",
    note: entry.note,
    sourceFile: entry.sourceFile,
    conciliationStatus: entry.conciliationStatus || "matched",
    isIntercompany: entry.isIntercompany,
    excludedFromDre: entry.excludedFromDre,
    intercompanyRuleId: entry.intercompanyRuleId,
    intercompanyReason: entry.intercompanyReason,
    counterpartyDocument: entry.counterpartyDocument,
    sourceAccount: entry.sourceAccount,
    destinationAccount: entry.destinationAccount,
    created: entry.created || new Date().toISOString(),
  };

  const updatedEntries = [newEntry, ...currentEntries.filter((e) => e.id !== newEntry.id)];
  const updatedState: CloudState = {
    ...(backendState ? formatCloudState(backendState) : currentState),
    manualEntries: updatedEntries,
    lastUpdated: new Date().toISOString(),
  };

  await writeFirebaseMirror(updatedState);
  try {
    localStorage.setItem("gestaofranquias_cloud_state", JSON.stringify(sanitizeClientValue(updatedState)));
  } catch {}

  return updatedState;
}

export async function createManualEntriesBulk(entries: Array<Partial<ManualEntry>>, userName?: string, userId?: string): Promise<CloudState> {
  let backendState: any = null;
  try {
    const result = await createManualEntriesBulkAPI(entries);
    if (result?.state) backendState = result.state;
  } catch (err) {
    console.warn("Backend bulk entry API notice, syncing directly with cloud:", err);
  }

  // O backend é a fonte autoritativa da importação: ele gera os IDs finais,
  // ignora duplicatas e aplica as regras LAVO/intercompany. Recriar as linhas
  // no cliente fazia a mesma base aparecer com outros IDs e podia reintroduzir
  // um espelho Firebase antigo nas demais telas.
  if (backendState) return persistReturnedState(backendState);

  const currentState = (await readFirebaseMirror()) || getLocalFallbackState();
  const existingEntries = Array.isArray(currentState.manualEntries) ? currentState.manualEntries : [];
  const now = Date.now();

  const knownIdentities = new Set(existingEntries.map((entry) => manualEntryIdentity(entry)));
  const newFullEntries: ManualEntry[] = entries
    .map((e, idx) => ({
      id: e.id || `m_${now}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      tenant: e.tenant || "dono",
      type: e.type || "despesa",
      date: e.date || new Date().toISOString().slice(0, 10),
      value: Number(e.value) || 0,
      desc: e.desc || "Lançamento",
      apelido: e.apelido,
      catId: e.catId || (e.type === "entrada" ? "receita" : "outros"),
      catName: e.catName || "Despesa",
      pay: e.pay || "Importação",
      note: e.note,
      sourceFile: e.sourceFile,
      conciliationStatus: e.conciliationStatus || "matched",
      isIntercompany: e.isIntercompany,
      excludedFromDre: e.excludedFromDre,
      intercompanyRuleId: e.intercompanyRuleId,
      intercompanyReason: e.intercompanyReason,
      counterpartyDocument: e.counterpartyDocument,
      sourceAccount: e.sourceAccount,
      destinationAccount: e.destinationAccount,
      created: e.created || new Date().toISOString(),
    }))
    .filter((entry) => {
      const identity = manualEntryIdentity(entry);
      if (knownIdentities.has(identity)) return false;
      knownIdentities.add(identity);
      return true;
    });

  const newIds = new Set(newFullEntries.map((e) => e.id));
  const combinedEntries = [...newFullEntries, ...existingEntries.filter((e) => !newIds.has(e.id))];

  const stateToSave: CloudState = {
    ...(backendState ? formatCloudState(backendState) : currentState),
    manualEntries: combinedEntries,
    lastUpdated: new Date().toISOString(),
  };

  await writeFirebaseMirror(stateToSave);
  try {
    localStorage.setItem("gestaofranquias_cloud_state", JSON.stringify(sanitizeClientValue(stateToSave)));
  } catch {}

  return stateToSave;
}

export async function deleteManualEntryAPI(id: string) {
  const res = await fetchWithTimeout(`/api/entries/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return safeResponseJSON(res, "Failed to delete entry");
}

export async function deleteManualEntry(id: string, userName?: string, userId?: string): Promise<CloudState> {
  let backendState: any = null;
  try {
    const result = await deleteManualEntryAPI(id);
    if (result?.state) backendState = result.state;
  } catch (err) {
    console.warn("Backend delete API notice, proceeding with cloud sync:", err);
  }

  const currentState = (await readFirebaseMirror()) || getLocalFallbackState();
  const currentEntries = Array.isArray(currentState.manualEntries) ? currentState.manualEntries : [];
  const updatedEntries = currentEntries.filter((e: any) => e.id !== id);

  const updatedState: CloudState = {
    ...(backendState ? formatCloudState(backendState) : currentState),
    manualEntries: updatedEntries,
    lastUpdated: new Date().toISOString(),
  };

  await writeFirebaseMirror(updatedState);
  try {
    localStorage.setItem("gestaofranquias_cloud_state", JSON.stringify(sanitizeClientValue(updatedState)));
  } catch {}

  return updatedState;
}

/** Devolve ao servidor os acessos guardados na cópia durável (após reinícios). */
export async function restoreAccessVault(): Promise<void> {
  try {
    const mirror = await readFirebaseMirror(4000);
    if (!mirror?.accessVault) return;
    await fetchWithTimeout("/api/auth/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vault: mirror.accessVault }),
    }, 8000);
  } catch {}
}

export async function loginAPI(username: string, password: string) {
  await restoreAccessVault();
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    credentials: "include",
  });
  const data = await safeResponseJSON(res, "Credenciais inválidas");
  if (data?.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function verifyMfaAPI(payload: { challengeToken?: string; setupToken?: string; secret?: string; code: string }) {
  const res = await fetch("/api/auth/mfa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  const data = await safeResponseJSON(res, "Não foi possível validar o MFA");
  if (data?.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function logoutAPI() {
  setAuthToken("");
  const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  const result = await safeResponseJSON(res, "Não foi possível encerrar a sessão");
  try {
    ["sofiacfo_cloud_state", "gestaofranquias_cloud_state", "sofiacfo_user_session", "gestao_user_session", "gestao_auth_token"].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  } catch {}
  return result;
}

export const loginApi = loginAPI;

export function subscribeToEvents(onUpdate: (state: CloudState) => void, onStorageStatus?: (durable: boolean) => void): () => void {
  let pollInterval: any = null;
  let pollInFlight = false;

  // Regular lightweight polling every 8 seconds (real-time experience with zero persistent socket overhead)
  pollInterval = setInterval(async () => {
    if (pollInFlight) return;
    pollInFlight = true;
    try {
      const [fresh, health] = await Promise.all([fetchServerState(), fetchHealth()]);
      onUpdate(fresh);
      onStorageStatus?.(health?.storage === "durable");
    } catch (e) {
      console.warn("Periodic sync poll failed:", e);
    } finally {
      pollInFlight = false;
    }
  }, 8000);

  return () => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  };
}
