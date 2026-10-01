import { createSignedSessionToken, decryptSecret, encryptSecret, getCredential, verifyMfaChallenge, verifyTotp } from "../../src/serverSecurity";
import { isTrustedRequest, json, readDatabase, readRequestBody, safeUser, sessionCookie, writeDatabase } from "../_store";

type AnyRecord = Record<string, any>;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  if (!isTrustedRequest(req)) return json(res, 403, { error: "Origem não autorizada." });
  const body = readRequestBody(req);
  const challenge = verifyMfaChallenge(String(body.challengeToken || body.setupToken || ""));
  if (!challenge) return json(res, 401, { error: "Desafio MFA expirado. Faça o login novamente." });

  const db = await readDatabase();
  const user = (db.users || []).find((candidate: AnyRecord) => candidate.id === challenge.sub && candidate.status !== "inativo");
  const credential = user ? getCredential(db, user.id) : null;
  if (!user || user.perfil !== "dono" || !credential) return json(res, 403, { error: "Acesso master não autorizado." });

  if (challenge.purpose === "mfa-setup") {
    const secret = String(body.secret || "").trim();
    if (!/^[A-Z2-7]{16,64}$/.test(secret) || !verifyTotp(secret, String(body.code || ""))) {
      return json(res, 400, { error: "Código MFA inválido. Confira o relógio do celular e tente novamente." });
    }
    db.mfaSecrets = { ...(db.mfaSecrets || {}), [user.id]: encryptSecret(secret) };
  } else {
    const secret = decryptSecret(String(db.mfaSecrets?.[user.id] || ""));
    if (!secret || !verifyTotp(secret, String(body.code || ""))) return json(res, 401, { error: "Código MFA inválido." });
  }

  user.last = new Date().toISOString();
  await writeDatabase(db);
  const token = createSignedSessionToken(user.id, credential.version, true);
  res.setHeader("Set-Cookie", sessionCookie(token));
  return json(res, 200, { user: safeUser(user), expiresAt: Date.now() + 8 * 60 * 60 * 1000, mfaEnabled: true });
}
