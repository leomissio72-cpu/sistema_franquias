import { isTrustedRequest, json, readDatabase, sessionUser } from "../_store";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return json(res, 405, { error: "Método não permitido." });
  if (!isTrustedRequest(req)) return json(res, 403, { error: "Origem não autorizada." });
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: "Sessão expirada. Faça login novamente." });
  const db = await readDatabase();
  return json(res, 200, { auditLogs: Array.isArray(db.auditLogs) ? db.auditLogs.slice(0, 50) : [] });
}
