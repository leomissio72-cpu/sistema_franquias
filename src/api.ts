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
  CloudState
} from "./types";
import {
  defaultPaymentMethods,
  defaultBusinessRules,
  initialBusinesses,
  initialFranchises,
  initialEmployees,
  initialUsers,
  initialManualEntries,
  initialConfigs,
} from "./data/initialData";

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
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

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error("Resposta do servidor inválida. " + defaultErrorMsg);
  }
}

export async function fetchHealth() {
  try {
    const res = await fetchWithTimeout("/api/health", {}, 2000);
    return await safeResponseJSON(res, "Health check failed");
  } catch (e) {
    return { status: "offline", mode: "local" };
  }
}

function getLocalFallbackState(): CloudState {
  try {
    const cached = localStorage.getItem("sofiacfo_cloud_state");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.businesses && parsed.businesses.length > 0) {
        return parsed;
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
    dreParams: {},
    paymentMethods: defaultPaymentMethods,
    businessRules: defaultBusinessRules,
    royalties: { biz1: 0.06, biz2: 0.05, biz3: 0.07 },
    permissions: {},
    vtConfigs: {},
    systemSettings: {
      appName: "Sofia CFO — Gestão Financeira para Franquias",
      companyName: "Sofia Franqueadora & Participações S.A.",
      cnpjMatriz: "12.345.678/0001-90",
    },
  };
}

export async function fetchServerState(): Promise<CloudState> {
  try {
    const res = await fetchWithTimeout("/api/state", {}, 3500);
    const data = await safeResponseJSON(res, "Failed to load server state");

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

    const state: CloudState = {
      ...data,
      cloudConfigs: data.configs || [],
      paymentMethods: safePaymentMethods,
      businessRules: safeRules,
      systemSettings: data.systemSettings || {
        appName: "Sofia CFO — Gestão Financeira para Franquias",
        companyName: "Sofia Franqueadora & Participações S.A.",
        cnpjMatriz: "12.345.678/0001-90",
      },
    };

    try {
      localStorage.setItem("sofiacfo_cloud_state", JSON.stringify(state));
    } catch (e) {}

    return state;
  } catch (err) {
    console.warn("Could not reach /api/state, using local/cached state:", err);
    return getLocalFallbackState();
  }
}

export async function fetchConfigs(): Promise<{ configs: ConfigItem[]; lastUpdated: string }> {
  const res = await fetch("/api/config");
  return safeResponseJSON(res, "Failed to fetch configs");
}

export async function updateSingleConfig(key: string, value: any, modifiedBy?: string, userId?: string) {
  const res = await fetch(`/api/config/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value, modifiedBy, userId }),
  });
  return safeResponseJSON(res, "Failed to update configuration");
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
  const res = await fetch("/api/config/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates, modifiedBy, userId }),
  });
  return safeResponseJSON(res, "Failed to bulk update configurations");
}

export async function fetchAuditLogs(): Promise<{ auditLogs: AuditLog[] }> {
  try {
    const res = await fetchWithTimeout("/api/config/audit", {}, 2500);
    return await safeResponseJSON(res, "Failed to fetch audit logs");
  } catch (e) {
    return { auditLogs: [] };
  }
}

export async function syncStateSection(section: string, data: any, user?: string): Promise<CloudState> {
  const res = await fetch("/api/state/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, data, user }),
  });
  if (!res.ok) throw new Error("Failed to sync state section");
  return fetchServerState();
}

export async function saveDreParams(tenantId: string, params: DreParams, userName: string, userId?: string): Promise<CloudState> {
  const currentState = await fetchServerState();
  const updatedDreParams = {
    ...currentState.dreParams,
    [tenantId]: params,
  };
  return syncStateSection("dreParams", updatedDreParams, userName);
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

export async function saveSystemSettings(settings: SystemSettings, userName: string, userId?: string): Promise<CloudState> {
  return syncStateSection("systemSettings", settings, userName);
}

export async function resetDatabase(): Promise<CloudState> {
  const res = await fetch("/api/state/reset", { method: "POST" });
  if (!res.ok) throw new Error("Failed to reset database");
  return fetchServerState();
}

export async function createManualEntryAPI(entry: Partial<ManualEntry>) {
  const res = await fetch("/api/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  return safeResponseJSON(res, "Failed to create entry");
}

export async function createManualEntriesBulkAPI(entries: Array<Partial<ManualEntry>>) {
  const res = await fetch("/api/entries/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries }),
  });
  return safeResponseJSON(res, "Failed to create bulk entries");
}

export async function createManualEntry(entry: Partial<ManualEntry>, userName?: string, userId?: string): Promise<CloudState> {
  await createManualEntryAPI(entry);
  return fetchServerState();
}

export async function createManualEntriesBulk(entries: Array<Partial<ManualEntry>>, userName?: string, userId?: string): Promise<CloudState> {
  await createManualEntriesBulkAPI(entries);
  return fetchServerState();
}

export async function deleteManualEntryAPI(id: string) {
  const res = await fetch(`/api/entries/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return safeResponseJSON(res, "Failed to delete entry");
}

export async function deleteManualEntry(id: string, userName?: string, userId?: string): Promise<CloudState> {
  await deleteManualEntryAPI(id);
  return fetchServerState();
}

export async function loginAPI(username: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return safeResponseJSON(res, "Credenciais inválidas");
}

export const loginApi = loginAPI;

export function subscribeToEvents(onUpdate: (state: CloudState) => void): () => void {
  let eventSource: EventSource | null = null;
  let pollInterval: any = null;

  try {
    eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "state_update" && parsed.data) {
          onUpdate({
            ...parsed.data,
            cloudConfigs: parsed.data.configs || [],
            paymentMethods: Array.isArray(parsed.data.paymentMethods)
              ? parsed.data.paymentMethods
              : parsed.data.paymentMethods?.["dono"] || [],
            businessRules: parsed.data.businessRules?.["dono"] || parsed.data.businessRules || {
              maxDiscount: 15,
              minTicket: 20,
              advance: false,
            },
            systemSettings: parsed.data.systemSettings || {
              appName: "Sofia CFO — Gestão Financeira para Franquias",
              companyName: "Sofia Franqueadora & Participações S.A.",
              cnpjMatriz: "12.345.678/0001-90",
            },
          });
        }
      } catch (err) {
        console.error("Error parsing SSE event:", err);
      }
    };

    eventSource.onerror = () => {
      // In serverless environments (Vercel) SSE connections close periodically.
      // Setup a light polling fallback every 30s so the user never gets blocked or spam-connected
      if (!pollInterval) {
        pollInterval = setInterval(async () => {
          try {
            const fresh = await fetchServerState();
            onUpdate(fresh);
          } catch (e) {}
        }, 30000);
      }
    };

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  } catch (e) {
    console.warn("EventSource not available, using periodic sync:", e);
    pollInterval = setInterval(async () => {
      try {
        const fresh = await fetchServerState();
        onUpdate(fresh);
      } catch (err) {}
    }, 30000);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }
}
