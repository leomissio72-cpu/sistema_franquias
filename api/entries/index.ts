import { isTrustedRequest, json, readDatabase, readRequestBody, sessionUser, writeDatabase } from "../_store";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  if (!isTrustedRequest(req)) return json(res, 403, { error: "Origem não autorizada." });
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: "Sessão expirada. Faça login novamente." });
  const item = readRequestBody(req);
  if (!item.desc || Number(item.value) <= 0 || !item.date) return json(res, 400, { error: "Dados incompletos do lançamento." });
  if (["franqueado", "operador"].includes(user.perfil) && String(item.tenant || "") !== String(user.unidade || "")) {
    return json(res, 403, { error: "Você só pode lançar dados na sua própria unidade." });
  }
  const db = await readDatabase();
  db.manualEntries = Array.isArray(db.manualEntries) ? db.manualEntries : [];
  const entry = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...item,
    value: Math.abs(Number(item.value)),
    created: new Date().toISOString(),
  };
  db.manualEntries.unshift(entry);
  await writeDatabase(db);
  return json(res, 200, { success: true, entry, lastUpdated: db.lastUpdated });
}
