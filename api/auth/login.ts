import crypto from "crypto";
import fs from "fs";
import path from "path";

type AnyRecord = Record<string, any>;

function json(res: any, status: number, payload: AnyRecord) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

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
        if (parsed && Array.isArray(parsed.users)) return parsed;
      }
    } catch {
      // Continue to the next known location.
    }
  }
  return { users: [] };
}

function readBody(req: any): AnyRecord {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function verifyPassword(input: string, stored: string): boolean {
  if (!stored?.startsWith("scrypt$")) return stored === input;
  const [, salt, expected] = stored.split("$");
  if (!salt || !expected || !/^[0-9a-f]+$/i.test(expected)) return false;
  try {
    const actual = crypto.scryptSync(input, salt, 64).toString("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const actualBuffer = Buffer.from(actual, "hex");
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export default function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });

  const body = readBody(req);
  const login = String(body.username || body.login || body.email || "").trim().toLowerCase();
  const password = String(body.password || body.senha || "");
  const database = readDatabase();
  const user = (database.users || []).find((candidate: AnyRecord) => {
    const candidateLogin = String(candidate.login || candidate.email || "").trim().toLowerCase();
    return candidateLogin === login && candidate.status !== "inativo" && verifyPassword(password, String(candidate.pass || candidate.password || ""));
  });

  if (!user) return json(res, 401, { error: "Credenciais inválidas. Verifique seu login e senha." });

  const token = `${user.id}.${Date.now()}.${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const { pass: _pass, password: _password, ...safeUser } = user;
  res.setHeader("Set-Cookie", `sofia_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${8 * 60 * 60}`);
  return json(res, 200, { user: safeUser, token, expiresAt });
}
