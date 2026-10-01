import { isTrustedRequest, json, readDatabase, readRequestBody, sessionUser } from "../_store";
import { stripSensitiveFields } from "../../src/serverSecurity";

type AnyRecord = Record<string, any>;
function canManage(user: AnyRecord | null) {
  return ["dono", "equipe", "admin"].includes(String(user?.perfil || ""));
}

export default async function handler(req: any, res: any) {
  if (!isTrustedRequest(req)) return json(res, 403, { error: "Origem não autorizada." });
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: "Sessão expirada. Faça login novamente." });
  if (!canManage(user)) return json(res, 403, { error: "Você não pode alterar configurações." });
  const db = await readDatabase();
  const key = String(req.query?.key || "").trim();
  if (!key || key.length > 160) return json(res, 400, { error: "Chave de configuração inválida." });
  const index = (db.configs || []).findIndex((item: AnyRecord) => item.key === key);
  if (index < 0) return json(res, 404, { error: "Configuração não encontrada." });
  if (req.method !== "PUT") return json(res, 405, { error: "Método não permitido." });
  const body = readRequestBody(req);
  const timestamp = new Date().toISOString();
  const previous = db.configs[index];
  db.configs[index] = { ...previous, value: String(body.value ?? ""), lastModified: timestamp, modifiedBy: String(body.modifiedBy || user.nome || user.login || "Administrador") };
  db.auditLogs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  db.auditLogs.unshift({ id: `audit_${Date.now()}`, timestamp, action: "UPDATE_CONFIG", key, oldValue: previous.value, newValue: stripSensitiveFields(db.configs[index].value), user: user.nome || user.login });
  db.auditLogs = db.auditLogs.slice(0, 200);
  const { writeDatabase } = await import("../_store");
  await writeDatabase(db);
  return json(res, 200, { success: true, config: db.configs[index], lastUpdated: db.lastUpdated });
}
