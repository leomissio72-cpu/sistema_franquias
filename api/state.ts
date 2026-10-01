import { isTrustedRequest, json, publicState, readDatabase, sessionUser } from "./_store";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return json(res, 405, { error: "Método não permitido." });
  if (!isTrustedRequest(req)) return json(res, 403, { error: "Origem não autorizada." });
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: "Sessão expirada. Faça login novamente." });
  const safe = publicState(await readDatabase());
  const restricted = ["franqueado", "operador"].includes(String(user.perfil || ""));
  const tenant = String(user.unidade || "");
  const visibleFranchises = restricted ? (safe.franchises || []).filter((item: any) => item.id === tenant) : (safe.franchises || []);
  const visibleBusinessIds = new Set(visibleFranchises.map((item: any) => item.businessId).filter(Boolean));
  return json(res, 200, {
    businesses: (Array.isArray(safe.businesses) ? safe.businesses : []).filter((item: any) => !restricted || visibleBusinessIds.has(item.id)),
    franchises: visibleFranchises,
    employees: (Array.isArray(safe.employees) ? safe.employees : []).filter((item: any) => !restricted || item.unidade === tenant),
    users: (Array.isArray(safe.users) ? safe.users : []).filter((item: any) => !restricted || item.unidade === tenant),
    manualEntries: (Array.isArray(safe.manualEntries) ? safe.manualEntries : []).filter((item: any) => !restricted || item.tenant === tenant),
    configs: Array.isArray(safe.configs) ? safe.configs : [],
    dreParams: safe.dreParams || {},
    paymentMethods: Array.isArray(safe.paymentMethods) ? safe.paymentMethods : [],
    businessRules: safe.businessRules || {},
    royalties: safe.royalties || {},
    permissions: safe.permissions || {},
    vtConfigs: safe.vtConfigs || {},
    systemSettings: safe.systemSettings || { appName: "Gestão de Franquias", companyName: "Gestão de Franquias" },
    lastUpdated: safe.lastUpdated || null,
  });
}
