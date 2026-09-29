import fs from "node:fs";
import path from "node:path";

function readDatabase() {
  const file = path.join(process.cwd(), "data", "database.json");
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return { configs: [], auditLogs: [] }; }
}

export default function handler(req: any, res: any) {
  const db = readDatabase();
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    return res.status(200).json({ configs: db.configs || [], lastUpdated: db.lastUpdated || null, total: (db.configs || []).length });
  }
  return res.status(405).json({ error: "Método não permitido neste endpoint público." });
}
