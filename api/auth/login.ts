import type { IncomingMessage, ServerResponse } from "node:http";

const users = [
  { id: "u1", nome: "Dono da Plataforma", email: "dono@sofiacfo.com", login: "dono", perfil: "dono", unidade: "dono", status: "ativo", employeeId: "e1", pass: "1234" },
  { id: "u2", nome: "Equipe Central", email: "equipe@sofiacfo.com", login: "equipe", perfil: "equipe", unidade: "dono", status: "ativo", employeeId: "e2", pass: "1234" },
  { id: "u3", nome: "Administrador Café", email: "admin.cafe@sofiacfo.com", login: "admin.cafe", perfil: "admin", unidade: "f001", status: "ativo", pass: "1234" },
  { id: "u4", nome: "Administrador Beleza", email: "admin.beleza@sofiacfo.com", login: "admin.beleza", perfil: "admin", unidade: "f002", status: "ativo", pass: "1234" },
  { id: "u5", nome: "Administrador Edukids", email: "admin.edukids@sofiacfo.com", login: "admin.edukids", perfil: "admin", unidade: "f004", status: "ativo", pass: "1234" },
  { id: "u6", nome: "Renata", email: "renata@sofiacfo.com", login: "renata.f001", perfil: "franqueado", unidade: "f001", status: "ativo", pass: "1234" },
  { id: "u7", nome: "Marcos", email: "marcos@sofiacfo.com", login: "marcos.f002", perfil: "franqueado", unidade: "f002", status: "ativo", pass: "1234" },
  { id: "u8", nome: "Juliana", email: "juliana@sofiacfo.com", login: "juliana.f004", perfil: "franqueado", unidade: "f004", status: "ativo", pass: "1234" },
  { id: "u9", nome: "Ana", email: "ana@sofiacfo.com", login: "ana.f007", perfil: "franqueado", unidade: "f007", status: "ativo", pass: "1234" },
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
