import { isTrustedRequest, json, readDatabase, readRequestBody, sessionUser, writeDatabase } from "../_store";
import { setCredential, stripSensitiveFields } from "../../src/serverSecurity";

type AnyRecord = Record<string, any>;

function isMaster(user: AnyRecord | null) {
  return user?.perfil === "dono" || user?.perfil === "equipe";
}

function canManageNetwork(user: AnyRecord | null) {
  return isMaster(user) || user?.perfil === "admin";
}

function cleanUsers(incoming: AnyRecord[], existing: AnyRecord[]) {
  return incoming.map((candidate) => {
    const current = existing.find((item) => item.id === candidate.id);
    const safeCandidate = stripSensitiveFields(candidate);
    if (!safeCandidate.last && current?.last) safeCandidate.last = current.last;
    return safeCandidate;
  });
}

function canManageCredential(actor: AnyRecord, target: AnyRecord): boolean {
  if (isMaster(actor) || actor.perfil === "admin") return true;
  return actor.perfil === "franqueado"
    && target.unidade === actor.unidade
    && ["operador", "franqueado"].includes(target.perfil);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  if (!isTrustedRequest(req)) return json(res, 403, { error: "Origem não autorizada." });
  const authenticatedUser = await sessionUser(req);
  if (!authenticatedUser) return json(res, 401, { error: "Sessão expirada. Faça login novamente." });

  const body = readRequestBody(req);
  const section = String(body.section || "");
  if (!section || body.data === undefined) return json(res, 400, { error: "Parâmetros inválidos para sincronização." });

  const db = await readDatabase();
  const userName = String(body.user || authenticatedUser.nome || authenticatedUser.login || "Sistema");
  let data = body.data;

  if (["businesses", "franchises", "configs", "royalties", "permissions", "systemSettings"].includes(section) && !canManageNetwork(authenticatedUser)) {
    return json(res, 403, { error: "Apenas a administração da rede pode alterar esta seção." });
  }

  if (section === "users") {
    if (authenticatedUser.perfil === "operador") return json(res, 403, { error: "Operadores não podem criar ou alterar acessos." });
    if (!Array.isArray(data) || data.length > 1000) return json(res, 400, { error: "Lista de usuários inválida." });
    if (authenticatedUser.perfil === "franqueado") {
      const ownUsers = data.filter((candidate: AnyRecord) => candidate.unidade === authenticatedUser.unidade);
      const invalid = ownUsers.find((candidate: AnyRecord) => !["operador", "franqueado"].includes(candidate.perfil));
      if (invalid || !authenticatedUser.unidade) return json(res, 403, { error: "O franqueado só pode criar acessos dentro da própria loja." });
      data = [...(db.users || []).filter((candidate: AnyRecord) => candidate.unidade !== authenticatedUser.unidade), ...ownUsers];
    }
    data = cleanUsers(data, db.users || []);
  }

  if (["manualEntries", "employees", "vtConfigs"].includes(section) && ["franqueado", "operador"].includes(authenticatedUser.perfil)) {
    const tenant = String(authenticatedUser.unidade || "");
    if (!tenant) return json(res, 403, { error: "Acesso sem unidade vinculada." });
    if (section === "manualEntries" || section === "employees") {
      if (!Array.isArray(data)) return json(res, 400, { error: "Lista inválida." });
      const incomingOwn = data.filter((item: AnyRecord) => String(item.tenant || item.unidade || "") === tenant);
      const preserved = (db[section] || []).filter((item: AnyRecord) => String(item.tenant || item.unidade || "") !== tenant);
      data = [...preserved, ...incomingOwn];
    }
  }

  if (section === "systemSettings" && data && typeof data === "object") {
    data = { ...data, autoSync: true, syncInterval: Number(data.syncInterval) > 0 ? Number(data.syncInterval) : 30 };
  }

  db[section] = stripSensitiveFields(data);

  const credential = body.credential && typeof body.credential === "object" ? body.credential : null;
  if (credential) {
    const targetId = String(credential.userId || "");
    const target = (db.users || []).find((candidate: AnyRecord) => candidate.id === targetId);
    const password = String(credential.password || "");
    if (!target || !canManageCredential(authenticatedUser, target)) return json(res, 403, { error: "Você não pode alterar esta credencial." });
    if (password.length < 12) return json(res, 400, { error: "A nova senha deve ter pelo menos 12 caracteres." });
    Object.assign(db, setCredential(db, targetId, password));
  }

  db.auditLogs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  db.auditLogs.unshift({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    action: `SYNC_${section.toUpperCase()}`,
    key: section,
    oldValue: null,
    newValue: `Updated ${section}`,
    user: userName,
  });
  if (db.auditLogs.length > 200) db.auditLogs = db.auditLogs.slice(0, 200);

  await writeDatabase(db);
  return json(res, 200, { success: true, section, lastUpdated: db.lastUpdated });
}
