import { readDatabase as readSharedDatabase } from "./_store";

function readDatabase() {
  return readSharedDatabase();
}

export default function handler(_req: any, res: any) {
  const db = readDatabase();
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({
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
  }));
}
