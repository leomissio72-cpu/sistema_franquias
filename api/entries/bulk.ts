import fs from "fs";
import path from "path";

type AnyRecord = Record<string, any>;
const TEMP_DB = "/tmp/gestao-franquias-database.json";

function respond(res: any, status: number, payload: AnyRecord) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readBody(req: any): AnyRecord {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function readDatabase(): AnyRecord {
  const candidates = [TEMP_DB, path.join(process.cwd(), "data", "database.json"), path.join("/var/task", "data", "database.json")];
  for (const filename of candidates) {
    try {
      if (fs.existsSync(filename)) {
        const parsed = JSON.parse(fs.readFileSync(filename, "utf8"));
        if (parsed && Array.isArray(parsed.users)) return parsed;
      }
    } catch {
      // Continue to the next known location.
    }
  }
  return { users: [], manualEntries: [] };
}

function hasSession(req: any, database: AnyRecord): boolean {
  const cookie = String(req.headers?.cookie || "");
  const raw = cookie.match(/(?:^|;\s*)gestao_session=([^;]+)/)?.[1];
  if (!raw) return false;
  const userId = decodeURIComponent(raw).split(".")[0];
  return (database.users || []).some((user: AnyRecord) => user.id === userId && user.status !== "inativo");
}

export default function handler(req: any, res: any) {
  if (req.method !== "POST") return respond(res, 405, { error: "Método não permitido." });

  const database = readDatabase();
  if (!hasSession(req, database)) return respond(res, 401, { error: "Sessão expirada. Faça login novamente." });

  const body = readBody(req);
  const entries = Array.isArray(body.entries) ? body.entries : [];
  if (!entries.length) return respond(res, 400, { error: "Lista de lançamentos vazia ou inválida." });

  const validEntries = entries
    .filter((item: AnyRecord) => item && item.desc && Number(item.value) > 0 && item.date)
    .map((item: AnyRecord, index: number) => ({
      id: `m_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
      ...item,
      value: Math.abs(Number(item.value)),
      created: new Date().toISOString(),
    }));

  if (!validEntries.length) return respond(res, 400, { error: "Nenhum lançamento válido para salvar." });

  database.manualEntries = Array.isArray(database.manualEntries) ? database.manualEntries : [];
  database.manualEntries.unshift(...validEntries);
  database.lastUpdated = new Date().toISOString();

  try {
    fs.writeFileSync(TEMP_DB, JSON.stringify(database, null, 2), "utf8");
  } catch {
    return respond(res, 500, { error: "Não foi possível persistir os lançamentos importados." });
  }

  return respond(res, 200, { success: true, count: validEntries.length, entries: validEntries, lastUpdated: database.lastUpdated });
}
