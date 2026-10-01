import crypto from "node:crypto";
import { isTrustedRequest, json, readDatabase, readRequestBody, writeDatabase } from "../_store";
import { setCredential } from "../../src/serverSecurity";

type AnyRecord = Record<string, any>;

function matchesSecret(provided: string, configured: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(configured);
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  if (!isTrustedRequest(req)) return json(res, 403, { error: "Origem não autorizada." });
  const configured = String(process.env.FRANQUIAS_BOOTSTRAP_TOKEN || "");
  const provided = String(req.headers?.["x-bootstrap-token"] || "");
  if (!configured || configured.length < 32 || !matchesSecret(provided, configured)) return json(res, 401, { error: "Bootstrap não autorizado." });

  const db = await readDatabase();
  if (db.bootstrapCompletedAt) return json(res, 409, { error: "O bootstrap master já foi utilizado e está invalidado." });
  const body = readRequestBody(req);
  const login = String(body.login || "dono").trim().toLowerCase();
  const password = String(body.password || "");
  if (password.length < 12) return json(res, 400, { error: "A nova senha deve ter pelo menos 12 caracteres." });

  const target = (db.users || []).find((user: AnyRecord) => String(user.login || "").trim().toLowerCase() === login)
    || (db.users || []).find((user: AnyRecord) => user.perfil === "dono");
  if (!target) return json(res, 404, { error: "Usuário master não encontrado." });
  target.perfil = "dono";
  target.status = "ativo";
  Object.assign(db, setCredential(db, target.id, password));
  db.mfaSecrets = { ...(db.mfaSecrets || {}) };
  delete db.mfaSecrets[target.id];
  db.bootstrapCompletedAt = new Date().toISOString();
  db.auditLogs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  db.auditLogs.unshift({ id: `audit_${Date.now()}`, timestamp: new Date().toISOString(), action: "MASTER_CREDENTIAL_ROTATED", key: target.id, oldValue: null, newValue: "Senha legada revogada; MFA pendente", user: "Bootstrap seguro" });
  await writeDatabase(db);
  return json(res, 200, { success: true, login: target.login, mfaRequiredOnNextLogin: true });
}
