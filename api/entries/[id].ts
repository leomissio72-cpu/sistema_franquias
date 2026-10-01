import { isTrustedRequest, json, readDatabase, readRequestBody, sessionUser, writeDatabase } from "../_store";

export default async function handler(req: any, res: any) {
  if (!isTrustedRequest(req)) return json(res, 403, { error: "Origem não autorizada." });
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: "Sessão expirada. Faça login novamente." });
  const db = await readDatabase();
  const id = String(req.query?.id || req.url?.split("/").pop() || "");
  const current = (db.manualEntries || []).find((entry: any) => entry.id === id);
  if (!current) return json(res, 404, { error: "Lançamento não encontrado." });
  if (["franqueado", "operador"].includes(user.perfil) && String(current.tenant || "") !== String(user.unidade || "")) {
    return json(res, 403, { error: "Você só pode alterar dados da sua própria unidade." });
  }

  if (req.method === "DELETE") {
    db.manualEntries = (db.manualEntries || []).filter((entry: any) => entry.id !== id);
    await writeDatabase(db);
    return json(res, 200, { success: true, id, lastUpdated: db.lastUpdated });
  }

  if (req.method === "PATCH" || req.method === "PUT") {
    const patch = readRequestBody(req);
    const allowed = ["conciliationStatus", "catId", "catName", "note"];
    db.manualEntries = (db.manualEntries || []).map((entry: any) => entry.id === id
      ? { ...entry, ...Object.fromEntries(allowed.filter((key) => patch[key] !== undefined).map((key) => [key, patch[key]])) }
      : entry);
    await writeDatabase(db);
    return json(res, 200, { success: true, entry: db.manualEntries.find((entry: any) => entry.id === id), lastUpdated: db.lastUpdated });
  }

  return json(res, 405, { error: "Método não permitido." });
}
