import fs from "fs";
import path from "path";

const TEMP_DB = "/tmp/gestao-franquias-database.json";
const sourceCandidates = [
  TEMP_DB,
  path.join(process.cwd(), "data", "database.json"),
  path.join(process.cwd(), "database.json"),
];

export function readDatabase(): any {
  for (const file of sourceCandidates) {
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      // Try the next source without replacing valid data with an empty state.
    }
  }
  return { users: [], manualEntries: [], lastUpdated: null };
}

export function writeDatabase(db: any): void {
  db.lastUpdated = new Date().toISOString();
  try {
    fs.writeFileSync(TEMP_DB, JSON.stringify(db, null, 2), "utf8");
  } catch {
    // Keep the request alive; the caller can return a controlled JSON response.
  }
}

export function readRequestBody(req: any): any {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

export function sessionUser(req: any): any | null {
  const cookieHeader = String(req.headers?.cookie || "");
  const token = cookieHeader.match(/(?:^|;\s*)gestao_session=([^;]+)/)?.[1];
  if (!token) return null;
  const userId = decodeURIComponent(token).split(".")[0];
  return (readDatabase().users || []).find((user: any) => user.id === userId) || null;
}

export function createSessionToken(userId: string): string {
  return `${userId}.${Date.now()}.${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function json(res: any, status: number, payload: any): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}
