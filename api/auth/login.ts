import type { IncomingMessage, ServerResponse } from "node:http";

const users = [
  { id: "u1", nome: "Administrador", email: "", login: "dono", perfil: "dono", unidade: "dono", status: "ativo", employeeId: "e1", pass: "1234" },
];

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end(JSON.stringify({ error: "Método não permitido." }));
    return;
  }
  const body = await readBody(req);
  const login = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const user = users.find((item) => item.login.toLowerCase() === login && item.pass === password);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!user) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Credenciais inválidas. Verifique seu login e senha." }));
    return;
  }
  const { pass: _pass, ...safeUser } = user;
  res.statusCode = 200;
  res.end(JSON.stringify({ user: { ...safeUser, last: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) }, token: `token_${user.id}_${Date.now()}` }));
}
