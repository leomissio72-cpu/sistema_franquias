import { isTrustedRequest, json, readDatabase, readRequestBody, sessionUser, writeDatabase } from "../_store";

type AnyRecord = Record<string, any>;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  if (!isTrustedRequest(req)) return json(res, 403, { error: "Origem não autorizada." });
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: "Sessão expirada. Faça login novamente." });

  const body = readRequestBody(req);
  const entries = Array.isArray(body.entries) ? body.entries : [];
  if (!entries.length) return json(res, 400, { error: "Lista de lançamentos vazia ou inválida." });
  const tenant = String(user.unidade || "");
  const validEntries = entries
    .filter((item: AnyRecord) => item && item.desc && Number(item.value) > 0 && item.date)
    .map((item: AnyRecord, index: number) => ({
      id: `m_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
      ...item,
      ...( ["franqueado", "operador"].includes(user.perfil) ? { tenant } : {} ),
      value: Math.abs(Number(item.value)),
      created: new Date().toISOString(),
    }));
  if (!validEntries.length) return json(res, 400, { error: "Nenhum lançamento válido para salvar." });
  if (["franqueado", "operador"].includes(user.perfil) && !tenant) return json(res, 403, { error: "Acesso sem unidade vinculada." });

  const database = await readDatabase();
  database.manualEntries = Array.isArray(database.manualEntries) ? database.manualEntries : [];
  database.manualEntries.unshift(...validEntries);
  await writeDatabase(database);
  return json(res, 200, { success: true, count: validEntries.length, entries: validEntries, lastUpdated: database.lastUpdated });
}
