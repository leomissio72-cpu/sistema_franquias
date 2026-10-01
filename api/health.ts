import { json, readDatabase } from "./_store";

export default async function handler(_req: any, res: any) {
  try {
    const db = await readDatabase();
    return json(res, 200, { status: "ok", cloud: "connected", storage: "durable", dbVersion: db.version || 2, lastUpdated: db.lastUpdated || null });
  } catch {
    return json(res, 503, { status: "degraded", cloud: "unavailable", storage: "not-configured" });
  }
}
