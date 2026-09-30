import crypto from "node:crypto";
import { createSessionToken, json, readDatabase, readRequestBody } from "../_store";

function verifyPassword(password: string, stored: string): boolean {
  if (!stored?.startsWith("scrypt$")) return stored === password;
  const [, salt, expected] = stored.split("$");
  if (!salt || !expected) return false;
  try {
    const actual = crypto.scryptSync(password, salt, 64).toString("hex");
    return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export default function handler(req: any, res: any) {
  if (req.method === "POST") {
    const { username, password } = readRequestBody(req);
    const login = String(username || "").trim();
    const secret = String(password || "");
    const db = readDatabase();
    const user = (db.users || []).find((candidate: any) => candidate.login === login || (candidate.email && candidate.email === login));

    if (!user || user.status === "inativo" || !verifyPassword(secret, String(user.pass || ""))) {
      return json(res, 401, { error: "Credenciais inválidas. Verifique seu login e senha." });
    }

    const token = createSessionToken(user.id);
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
    const { pass: _pass, ...safeUser } = user;
    res.setHeader("Set-Cookie", `gestao_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${8 * 60 * 60}`);
    return json(res, 200, { user: safeUser, token, expiresAt });
  }

  if (req.method === "DELETE" || req.method === "OPTIONS") {
    res.setHeader("Set-Cookie", "gestao_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
    return json(res, 200, { success: true });
  }

  return json(res, 405, { error: "Método não permitido." });
}
