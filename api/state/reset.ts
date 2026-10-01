import { isTrustedRequest, json, readDatabase, readRequestBody, sessionUser, writeDatabase } from "../_store";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  if (!isTrustedRequest(req)) return json(res, 403, { error: "Origem não autorizada." });
  const user = await sessionUser(req);
  if (!user || user.mfaVerified !== true || user.perfil !== "dono") return json(res, 403, { error: "Somente o acesso master com MFA pode resetar a base." });
  const body = readRequestBody(req);
  if (body.confirm !== "RESETAR_BASE") return json(res, 400, { error: "Confirmação inválida." });
  const current = await readDatabase();
  const next = {
    ...current,
    businesses: [], franchises: [], employees: [], users: current.users || [], manualEntries: [],
    lastUpdated: new Date().toISOString(),
    auditLogs: [{ id: `audit_${Date.now()}`, timestamp: new Date().toISOString(), action: "RESET_DATABASE", key: "database", oldValue: null, newValue: "Dados operacionais resetados", user: user.nome || user.login }, ...(current.auditLogs || [])].slice(0, 200),
  };
  await writeDatabase(next);
  return json(res, 200, { success: true, lastUpdated: next.lastUpdated });
}
