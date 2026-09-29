import { json, readDatabase, readRequestBody, sessionUser, writeDatabase } from "../_store";

export default function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  if (!sessionUser(req)) return json(res, 401, { error: "Sessão expirada. Faça login novamente." });
  const { entries } = readRequestBody(req);
  if (!Array.isArray(entries) || entries.length === 0) return json(res, 400, { error: "Lista de lançamentos vazia ou inválida." });
  const db = readDatabase();
  db.manualEntries = Array.isArray(db.manualEntries) ? db.manualEntries : [];
  const now = Date.now();
  const createdEntries = entries.filter((item: any) => item?.desc && Number(item.value) > 0 && item?.date).map((item: any, index: number) => ({
    id: `m_${now}_${index}_${Math.random().toString(36).slice(2, 8)}`,
    ...item,
    value: Math.abs(Number(item.value)),
    created: new Date().toISOString(),
  }));
  if (!createdEntries.length) return json(res, 400, { error: "Nenhum lançamento válido para salvar." });
  db.manualEntries.unshift(...createdEntries);
  writeDatabase(db);
  return json(res, 200, { success: true, count: createdEntries.length, entries: createdEntries, lastUpdated: db.lastUpdated });
}
