import { json, readDatabase, readRequestBody, sessionUser, writeDatabase } from "../_store";

export default function handler(req: any, res: any) {
  if (!sessionUser(req)) return json(res, 401, { error: "Sessão expirada. Faça login novamente." });
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  const item = readRequestBody(req);
  if (!item.desc || Number(item.value) <= 0 || !item.date) return json(res, 400, { error: "Dados incompletos do lançamento." });
  const db = readDatabase();
  db.manualEntries = Array.isArray(db.manualEntries) ? db.manualEntries : [];
  const entry = { id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...item, value: Math.abs(Number(item.value)), created: new Date().toISOString() };
  db.manualEntries.unshift(entry);
  writeDatabase(db);
  return json(res, 200, { success: true, entry, lastUpdated: db.lastUpdated });
}
