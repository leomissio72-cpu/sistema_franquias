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
import { defaultPaymentMethods, defaultBusinessRules } from "./data/initialData";

export async function fetchHealth() {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

export async function fetchServerState(): Promise<CloudState> {
  const res = await fetch("/api/state");
  if (!res.ok) throw new Error("Failed to load server state");
  const data = await res.json();

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
    paymentMethods: safePaymentMethods,
    businessRules: safeRules,
    systemSettings: data.systemSettings || {
      appName: "Sofia CFO — Gestão Financeira para Franquias",
      companyName: "Sofia Franqueadora & Participações S.A.",
      cnpjMatriz: "12.345.678/0001-90",
    },
  };
}

export async function fetchConfigs(): Promise<{ configs: ConfigItem[]; lastUpdated: string }> {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Failed to fetch configs");
  return res.json();
}

export async function updateSingleConfig(key: string, value: any, modifiedBy?: string, userId?: string) {
  const res = await fetch(`/api/config/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value, modifiedBy, userId }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update configuration");
  }
  return res.json();
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
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to bulk update configurations");
  }
  return res.json();
}

export async function fetchAuditLogs(): Promise<{ auditLogs: AuditLog[] }> {
  const res = await fetch("/api/config/audit");
  if (!res.ok) throw new Error("Failed to fetch audit logs");
  return res.json();
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
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to create entry");
  }
  return res.json();
}

export async function createManualEntriesBulkAPI(entries: Array<Partial<ManualEntry>>) {
  const res = await fetch("/api/entries/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to create bulk entries");
  }
  return res.json();
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
  if (!res.ok) throw new Error("Failed to delete entry");
  return res.json();
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
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Credenciais inválidas");
  }
  return res.json();
}

export const loginApi = loginAPI;

export function subscribeToEvents(onUpdate: (state: CloudState) => void): () => void {
  try {
    const eventSource = new EventSource("/api/events");

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

    eventSource.onerror = (err) => {
      console.warn("SSE connection error, will reconnect automatically:", err);
    };

    return () => {
      eventSource.close();
    };
  } catch (e) {
    console.error("Failed to initialize EventSource:", e);
    return () => {};
  }
}
