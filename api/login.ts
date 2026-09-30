import crypto from "node:crypto";
import { createSessionToken, json, readDatabase, readRequestBody } from "./_store";

function verifyPassword(input: string, stored: string) {
  if (!stored?.startsWith("scrypt$")) return stored === input;
  const [, salt, expected] = stored.split("$");
  const actual = crypto.scryptSync(input, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export default function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  const body = readRequestBody(req);
  const login = String(body.login || body.username || body.email || "").trim().toLowerCase();
  const password = String(body.password || body.senha || "");
  const db = readDatabase();
  const user = (Array.isArray(db.users) ? db.users : []).find((item: any) =>
    String(item.login || item.email || "").trim().toLowerCase() === login &&
    verifyPassword(password, String(item.pass || item.password || "")) &&
    item.status !== "inativo"
  );
  if (!user) return json(res, 401, { error: "Login ou senha inválidos." });
  const token = createSessionToken(String(user.id));
  res.setHeader("Set-Cookie", `gestao_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${8 * 60 * 60}`);
  return json(res, 200, {
    user: {
      id: user.id,
      login: user.login,
      nome: user.nome,
      email: user.email,
      unidade: user.unidade,
      perfil: user.perfil,
      status: user.status,
    },
    token,
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  });
}
