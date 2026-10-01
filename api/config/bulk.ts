import { isTrustedRequest, json, readDatabase, readRequestBody, sessionUser, writeDatabase } from "../_store";

type AnyRecord = Record<string, any>;
function canManage(user: AnyRecord | null) {
  return ["dono", "equipe", "admin"].includes(String(user?.perfil || ""));
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  if (!isTrustedRequest(req)) return json(res, 403, { error: "Origem não autorizada." });
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: "Sessão expirada. Faça login novamente." });
  if (!canManage(user)) return json(res, 403, { error: "Você não pode alterar configurações." });
  const body = readRequestBody(req);
  if (!Array.isArray(body.updates) || body.updates.length > 100) return json(res, 400, { error: "Lista de atualizações inválida." });
  const db = await readDatabase();
  const timestamp = new Date().toISOString();
  const changed: string[] = [];
  for (const update of body.updates as AnyRecord[]) {
    const key = String(update?.key || "");
    const index = (db.configs || []).findIndex((item: AnyRecord) => item.key === key);
    if (index < 0) continue;
    const previous = db.configs[index];
    db.configs[index] = { ...previous, value: String(update.value ?? ""), lastModified: timestamp, modifiedBy: String(body.modifiedBy || user.nome || user.login || "Administrador") };
    changed.push(key);
  }
  db.auditLogs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  db.auditLogs.unshift({ id: `audit_${Date.now()}`, timestamp, action: "BULK_UPDATE_CONFIG", key: changed.join(","), oldValue: null, newValue: `${changed.length} configurações atualizadas`, user: user.nome || user.login });
  db.auditLogs = db.auditLogs.slice(0, 200);
  await writeDatabase(db);
  return json(res, 200, { success: true, configs: db.configs, lastUpdated: db.lastUpdated });
}
