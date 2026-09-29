import { json, readDatabase, sessionUser, writeDatabase } from "../_store";

export default function handler(req: any, res: any) {
  if (req.method !== "DELETE") return json(res, 405, { error: "Método não permitido." });
  if (!sessionUser(req)) return json(res, 401, { error: "Sessão expirada. Faça login novamente." });
  const db = readDatabase();
  const id = String(req.query?.id || req.url?.split("/").pop() || "");
  db.manualEntries = (db.manualEntries || []).filter((entry: any) => entry.id !== id);
  writeDatabase(db);
  return json(res, 200, { success: true, id, lastUpdated: db.lastUpdated });
}
