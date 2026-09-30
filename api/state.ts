import fs from "fs";
import path from "path";

type AnyRecord = Record<string, any>;

function readDatabase(): AnyRecord {
  const candidates = [
    path.join(process.cwd(), "data", "database.json"),
    path.join("/var/task", "data", "database.json"),
    path.join("/tmp", "database.json"),
  ];
  for (const filename of candidates) {
    try {
      if (fs.existsSync(filename)) {
        const parsed = JSON.parse(fs.readFileSync(filename, "utf8"));
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {
      // Try the next known location.
    }
  }
  return { businesses: [], franchises: [], employees: [], users: [], manualEntries: [], configs: [] };
}

export default function handler(_req: any, res: any) {
  const db = readDatabase();
  const payload = {
    businesses: Array.isArray(db.businesses) ? db.businesses : [],
    franchises: Array.isArray(db.franchises) ? db.franchises : [],
    employees: Array.isArray(db.employees) ? db.employees : [],
    users: (Array.isArray(db.users) ? db.users : []).map(({ pass: _pass, password: _password, ...user }: AnyRecord) => user),
    manualEntries: Array.isArray(db.manualEntries) ? db.manualEntries : [],
    configs: Array.isArray(db.configs) ? db.configs : [],
    dreParams: db.dreParams || {},
    paymentMethods: Array.isArray(db.paymentMethods) ? db.paymentMethods : [],
    businessRules: db.businessRules || {},
    royalties: db.royalties || {},
    permissions: db.permissions || {},
    vtConfigs: db.vtConfigs || {},
    systemSettings: db.systemSettings || { appName: "Gestão de Franquias", companyName: "Gestão de Franquias" },
    lastUpdated: db.lastUpdated || null,
  };
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}
