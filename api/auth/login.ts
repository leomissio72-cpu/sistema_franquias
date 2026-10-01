import {
  createMfaChallenge,
  createSignedSessionToken,
  createTotpSecret,
  decryptSecret,
  getCredential,
  verifyPassword,
  totpUri,
} from "../../src/serverSecurity";
import { isTrustedRequest, json, readDatabase, readRequestBody, sessionCookie, writeDatabase, safeUser } from "../_store";

type AnyRecord = Record<string, any>;
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  if (!isTrustedRequest(req)) return json(res, 403, { error: "Origem não autorizada." });
  const body = readRequestBody(req);
  const login = String(body.username || body.login || body.email || "").trim().toLowerCase();
  const password = String(body.password || body.senha || "");
  if (!login || !password || login.length > 160 || password.length > 256) return json(res, 401, { error: "Credenciais inválidas." });

  const clientKey = String(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].slice(0, 80);
  const attempt = attempts.get(clientKey);
  if (attempt && attempt.resetAt > Date.now() && attempt.count >= MAX_ATTEMPTS) return json(res, 429, { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });

  const database = await readDatabase();
  const user = (database.users || []).find((candidate: AnyRecord) => {
    const candidateLogin = String(candidate.login || candidate.email || "").trim().toLowerCase();
    return candidateLogin === login && candidate.status !== "inativo";
  });
  const credential = user ? getCredential(database, user.id) : null;
  if (!user || !credential || !verifyPassword(password, credential.passwordHash)) {
    const current = attempts.get(clientKey);
    attempts.set(clientKey, { count: (current?.resetAt || 0) > Date.now() ? (current?.count || 0) + 1 : 1, resetAt: Date.now() + WINDOW_MS });
    return json(res, 401, { error: "Credenciais inválidas ou senha antiga revogada. O administrador precisa cadastrar uma nova senha." });
  }
  attempts.delete(clientKey);

  const mfaSecret = user.perfil === "dono" ? decryptSecret(String(database.mfaSecrets?.[user.id] || "")) : null;
  if (user.perfil === "dono" && !mfaSecret) {
    const secret = createTotpSecret();
    return json(res, 200, {
      mfaSetupRequired: true,
      setupToken: createMfaChallenge(user.id, "mfa-setup"),
      secret,
      otpauth: totpUri(secret, user.login),
      user: safeUser(user),
    });
  }
  if (user.perfil === "dono") {
    return json(res, 200, {
      mfaRequired: true,
      challengeToken: createMfaChallenge(user.id, "mfa-login"),
      user: safeUser(user),
    });
  }

  user.last = new Date().toISOString();
  const token = createSignedSessionToken(user.id, credential.version, false);
  await writeDatabase(database);
  res.setHeader("Set-Cookie", sessionCookie(token));
  return json(res, 200, { user: safeUser(user), expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
}
