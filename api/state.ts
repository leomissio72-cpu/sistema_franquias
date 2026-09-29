import fs from "node:fs";
import path from "node:path";

function readDatabase() {
  const candidates = [
    path.join(process.cwd(), "data", "database.json"),
    path.join(process.cwd(), "database.json"),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      // Try the next known location.
    }
  }
  return {
    businesses: [], franchises: [], employees: [], users: [], manualEntries: [],
    configs: [], dreParams: {}, paymentMethods: [], businessRules: {},
    royalties: {}, permissions: {}, vtConfigs: {}, lastUpdated: null,
  };
}

export default function handler(_req: any, res: any) {
  const db = readDatabase();
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    businesses: db.businesses || [],
    franchises: db.franchises || [],
    employees: db.employees || [],
    users: (db.users || []).map(({ pass: _pass, ...user }: any) => user),
    manualEntries: db.manualEntries || [],
    configs: db.configs || [],
    dreParams: db.dreParams || {},
    paymentMethods: db.paymentMethods || [],
    businessRules: db.businessRules || {},
    royalties: db.royalties || {},
    permissions: db.permissions || {},
    vtConfigs: db.vtConfigs || {},
    systemSettings: db.systemSettings || { appName: "Gestão de Franquias", companyName: "Gestão de Franquias" },
    lastUpdated: db.lastUpdated || null,
  });
}
