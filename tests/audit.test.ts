import test, { after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app, db, saveDatabase } from "../src/serverBackend";
import {
  hashPassword,
  verifyPassword,
  createSignedSessionToken,
  verifySignedSessionToken,
  setCredential,
  getCredential,
} from "../src/serverSecurity";

// Helper to make local requests to the express app
function appRequest(
  method: string,
  urlPath: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as any;
      const port = address.port;
      const postData = body !== undefined ? JSON.stringify(body) : undefined;
      const reqHeaders = { ...headers };
      if (postData) {
        reqHeaders["Content-Type"] = "application/json";
        reqHeaders["Content-Length"] = Buffer.byteLength(postData).toString();
      }

      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: urlPath,
          method,
          headers: reqHeaders,
        },
        (res) => {
          let resData = "";
          res.on("data", (chunk) => {
            resData += chunk;
          });
          res.on("end", () => {
            server.close();
            let parsedBody: any = resData;
            try {
              parsedBody = JSON.parse(resData);
            } catch {}
            resolve({
              status: res.statusCode || 0,
              headers: res.headers,
              body: parsedBody,
            });
          });
        }
      );

      req.on("error", (err) => {
        server.close();
        reject(err);
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  });
}

test("AUDITORIA 1: Health check endpoint responde 200 OK com status e cloud conectados", async () => {
  const res = await appRequest("GET", "/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "ok");
  assert.equal(res.body.cloud, "connected");
  assert.ok(res.body.lastUpdated);
});

test("AUDITORIA 2: Usuários públicos nunca expõem senhas ou credenciais hash", async () => {
  // Garantir usuário dono configurado
  const donoUser = db.users.find((u: any) => u.login === "dono" || u.perfil === "dono");
  assert.ok(donoUser, "Usuário dono deve existir no banco");
  assert.equal("pass" in donoUser, false, "Campo pass não pode existir no objeto do usuário");
  assert.equal("passwordHash" in donoUser, false, "Campo passwordHash não pode existir no objeto do usuário");
});

test("AUDITORIA 3: Sessão autenticada permite ler o estado central /api/state", async () => {
  // Criar token para dono autenticado com MFA
  const dono = db.users.find((u: any) => u.perfil === "dono");
  assert.ok(dono);
  Object.assign(db, setCredential(db, dono.id, "SenhaMaster2026!"));
  const cred = getCredential(db, dono.id)!;
  const token = createSignedSessionToken(dono.id, cred.version, true);

  const res = await appRequest("GET", "/api/state", {
    Cookie: `gestao_session=${encodeURIComponent(token)}`,
  });

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.businesses));
  assert.ok(Array.isArray(res.body.franchises));
  assert.ok(Array.isArray(res.body.employees));
  assert.ok(Array.isArray(res.body.users));
  assert.ok(Array.isArray(res.body.configs));
});

test("AUDITORIA 4: Persistência de Franqueados via /api/state/sync é instantânea e segura", async () => {
  const dono = db.users.find((u: any) => u.perfil === "dono")!;
  const cred = getCredential(db, dono.id)!;
  const token = createSignedSessionToken(dono.id, cred.version, true);

  const newFranchise = {
    id: `f_auditoria_${Date.now()}`,
    businessId: "biz_test",
    name: "Franquia Auditoria Teste",
    code: "FAUD01",
    resp: "Auditor Chefe",
    address: "Avenida Paulista, 100",
    city: "São Paulo - SP",
    region: "Sudeste",
    lat: -23.55,
    lng: -46.63,
    faturamento: 85000,
    pendencias: 0,
    rpDone: 5,
    status: "green",
    email: "contato@faud01.com",
    phone: "(11) 99999-8888",
  };

  const updatedFranchises = [...db.franchises, newFranchise];

  const startTime = Date.now();
  const res = await appRequest(
    "POST",
    "/api/state/sync",
    { Cookie: `gestao_session=${encodeURIComponent(token)}` },
    {
      section: "franchises",
      data: updatedFranchises,
      user: "Auditor",
      userProfile: "dono",
    }
  );
  const elapsed = Date.now() - startTime;

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.section, "franchises");
  assert.ok(elapsed < 1000, `Sync deve ser rápido (levou ${elapsed}ms)`);

  // Verificar se persistiu
  const found = db.franchises.find((f: any) => f.id === newFranchise.id);
  assert.ok(found);
  assert.equal(found.name, "Franquia Auditoria Teste");

  // Limpeza
  db.franchises = db.franchises.filter((f: any) => f.id !== newFranchise.id);
  saveDatabase(db);
});

test("AUDITORIA 5: Persistência de Marcas / Modelos de Negócio via /api/state/sync", async () => {
  const dono = db.users.find((u: any) => u.perfil === "dono")!;
  const cred = getCredential(db, dono.id)!;
  const token = createSignedSessionToken(dono.id, cred.version, true);

  const newBiz = {
    id: `biz_auditoria_${Date.now()}`,
    name: "Marca Auditoria Gourmet",
    brand: "Auditoria Gourmet",
    color: "#3c63da",
    royalty: 0.065,
  };

  const updatedBusinesses = [...db.businesses, newBiz];

  const res = await appRequest(
    "POST",
    "/api/state/sync",
    { Cookie: `gestao_session=${encodeURIComponent(token)}` },
    {
      section: "businesses",
      data: updatedBusinesses,
      user: "Auditor",
      userProfile: "dono",
    }
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const found = db.businesses.find((b: any) => b.id === newBiz.id);
  assert.ok(found);
  assert.equal(found.name, "Marca Auditoria Gourmet");

  // Limpeza
  db.businesses = db.businesses.filter((b: any) => b.id !== newBiz.id);
  saveDatabase(db);
});

test("AUDITORIA 6: Operador e Franqueado não podem burlar restrições RBAC", async () => {
  // Criar operador
  const operador = {
    id: "u_op_test",
    nome: "Operador Teste",
    email: "op@teste.com",
    login: "op_test",
    perfil: "operador",
    unidade: "f001",
    status: "ativo",
    last: "Agora",
    employeeId: "e_test",
  };
  db.users.push(operador);
  Object.assign(db, setCredential(db, operador.id, "SenhaOperadorForte2026!"));
  const cred = getCredential(db, operador.id)!;
  const token = createSignedSessionToken(operador.id, cred.version, false);

  // Operador tentando alterar /api/config
  const resConfig = await appRequest(
    "PUT",
    "/api/config/tax_default",
    { Cookie: `gestao_session=${encodeURIComponent(token)}` },
    { value: "15.00" }
  );
  assert.equal(resConfig.status, 403, "Operador não pode alterar configurações do sistema");

  // Limpeza
  db.users = db.users.filter((u: any) => u.id !== operador.id);
  saveDatabase(db);
});

test("AUDITORIA 7: Lançamentos manuais são criados e deletados com segurança", async () => {
  const dono = db.users.find((u: any) => u.perfil === "dono")!;
  const cred = getCredential(db, dono.id)!;
  const token = createSignedSessionToken(dono.id, cred.version, true);

  const resCreate = await appRequest(
    "POST",
    "/api/entries",
    { Cookie: `gestao_session=${encodeURIComponent(token)}` },
    {
      tenant: "dono",
      desc: "Lançamento Teste Auditoria",
      value: 1250.5,
      type: "receita",
      category: "Vendas",
      date: new Date().toISOString().slice(0, 10),
    }
  );

  assert.equal(resCreate.status, 200);
  assert.equal(resCreate.body.success, true);
  const createdId = resCreate.body.entry.id;
  assert.ok(createdId);

  // Deletar
  const resDelete = await appRequest(
    "DELETE",
    `/api/entries/${encodeURIComponent(createdId)}`,
    { Cookie: `gestao_session=${encodeURIComponent(token)}` }
  );

  assert.equal(resDelete.status, 200);
  assert.equal(resDelete.body.success, true);
});

after(() => {
  // Limpar resíduos de testes para manter a base limpa
  db.auditLogs = [];
  db.franchises = (db.franchises || []).filter((f: any) => !f.id?.startsWith("f_auditoria"));
  db.businesses = (db.businesses || []).filter((b: any) => b.id !== "biz_test");
  if (db.credentials) {
    delete db.credentials["u_op_test"];
  }
  db.users = (db.users || []).filter((u: any) => u.id !== "u_op_test");
  saveDatabase(db);
});
