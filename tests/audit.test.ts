import test, { after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import { app, db, saveDatabase } from "../src/serverBackend";
import {
  hashPassword,
  verifyPassword,
  createSignedSessionToken,
  verifySignedSessionToken,
  setCredential,
  getCredential,
} from "../src/serverSecurity";
import { decodeBankText, repairMojibake } from "../src/utils/textEncoding";

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

test("AUDITORIA 2B: Estado central não fica disponível sem sessão", async () => {
  const res = await appRequest("GET", "/api/state");
  assert.equal(res.status, 401);
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

test("AUDITORIA 8: Importação ignora duplicidades e operador não exclui conciliação", async () => {
  const dono = db.users.find((u: any) => u.perfil === "dono")!;
  const donoCredential = getCredential(db, dono.id)!;
  const donoToken = createSignedSessionToken(dono.id, donoCredential.version, true);
  const duplicateEntry = {
    tenant: "dono",
    desc: "Conciliação idempotente teste",
    value: 321.45,
    type: "entrada",
    date: "2026-10-06",
    sourceFile: "extrato-a.ofx",
  };

  const resBulk = await appRequest(
    "POST",
    "/api/entries/bulk",
    { Cookie: `gestao_session=${encodeURIComponent(donoToken)}` },
    { entries: [duplicateEntry, { ...duplicateEntry, sourceFile: "extrato-b.ofx" }] },
  );

  assert.equal(resBulk.status, 200);
  assert.equal(resBulk.body.count, 1);
  assert.equal(resBulk.body.duplicateCount, 1);
  const importedId = resBulk.body.entries[0].id;
  assert.ok(importedId);

  const operador = {
    id: "u_op_conciliation_test",
    nome: "Operador Conciliação",
    email: "operador-conciliacao@teste.com",
    login: "op_conciliation_test",
    perfil: "operador",
    unidade: "dono",
    status: "ativo",
  };
  db.users.push(operador);
  Object.assign(db, setCredential(db, operador.id, "SenhaOperadorForte2026!"));
  const operatorCredential = getCredential(db, operador.id)!;
  const operatorToken = createSignedSessionToken(operador.id, operatorCredential.version, false);
  const resDelete = await appRequest(
    "DELETE",
    `/api/entries/${encodeURIComponent(importedId)}`,
    { Cookie: `gestao_session=${encodeURIComponent(operatorToken)}` },
  );
  assert.equal(resDelete.status, 403);

  const resSyncDelete = await appRequest(
    "POST",
    "/api/state/sync",
    { Cookie: `gestao_session=${encodeURIComponent(operatorToken)}` },
    { section: "manualEntries", data: db.manualEntries.filter((entry: any) => entry.id !== importedId) },
  );
  assert.equal(resSyncDelete.status, 403);

  db.manualEntries = db.manualEntries.filter((entry: any) => entry.id !== importedId);
  db.users = db.users.filter((user: any) => user.id !== operador.id);
  if (db.credentials) delete db.credentials[operador.id];
  saveDatabase(db);
});

test("AUDITORIA 10: Regra intercompany preserva a linha e exclui o lançamento do DRE", async () => {
  const dono = db.users.find((user: any) => user.perfil === "dono")!;
  const credential = getCredential(db, dono.id)!;
  const token = createSignedSessionToken(dono.id, credential.version, true);
  const previousRules = db.intercompanyRules || [];
  assert.ok(previousRules.some((rule: any) => rule.counterpartyDocuments?.includes("53.374.430/0001-30")));
  assert.ok(previousRules.some((rule: any) => rule.counterpartyAccounts?.includes("9363737-3")));
  assert.ok(previousRules.some((rule: any) => rule.counterpartyAccounts?.includes("67061627-5")));
  const rule = {
    id: `rule_auditoria_${Date.now()}`,
    name: "Transferência para matriz - auditoria",
    active: true,
    scope: "rede",
    terms: ["TED PARA MATRIZ"],
    counterpartyDocuments: [],
    counterpartyAccounts: [],
  };
  db.intercompanyRules = [...previousRules, rule];
  await saveDatabase(db);

  const date = new Date().toISOString().slice(0, 10);
  const res = await appRequest("POST", "/api/entries/bulk", {
    Cookie: `gestao_session=${encodeURIComponent(token)}`,
  }, {
    entries: [{
      tenant: "dono",
      desc: "TED para matriz - transferência interna",
      value: 987.65,
      type: "despesa",
      date,
      sourceFile: "extrato-intercompany.ofx",
    }],
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.count, 1);
  const entry = res.body.entries[0];
  assert.equal(entry.isIntercompany, true);
  assert.equal(entry.excludedFromDre, true);
  assert.equal(entry.catId, "intercompany");
  assert.equal(entry.intercompanyRuleId, rule.id);

  db.manualEntries = db.manualEntries.filter((candidate: any) => candidate.id !== entry.id);
  db.intercompanyRules = previousRules;
  await saveDatabase(db);
});

test("AUDITORIA 11: Texto bancário preserva acentos em UTF-8, mojibake e Windows-1252", () => {
  assert.equal(repairMojibake("CartÃ£o de DÃ©bito - Stone"), "Cartão de Débito - Stone");
  assert.equal(repairMojibake("AntecipaÃ§Ã£o"), "Antecipação");
  const windows1252 = Uint8Array.from([0x43, 0x61, 0x72, 0x74, 0xe3, 0x6f, 0x20, 0x64, 0x65, 0x20, 0xc9, 0x62, 0x69, 0x74, 0x6f]);
  assert.equal(decodeBankText(windows1252), "Cartão de Ébito");
  assert.equal(decodeBankText(new TextEncoder().encode("Conciliação;Descrição\n2026-10-05;Antecipação")), "Conciliação;Descrição\n2026-10-05;Antecipação");
});

test("AUDITORIA 12: Limpeza operacional exige Dono e preserva usuários, regras e auditoria", async () => {
  const snapshot = JSON.parse(JSON.stringify(db));
  const dono = db.users.find((user: any) => user.perfil === "dono")!;
  const credential = getCredential(db, dono.id)!;
  const token = createSignedSessionToken(dono.id, credential.version, true);
  db.businesses = [{ id: "biz_clear_test", name: "Teste", brand: "Teste", color: "#000000" }];
  db.franchises = [{ id: "f_clear_test", businessId: "biz_clear_test", name: "Unidade teste", code: "CLR", resp: "Teste", address: "Rua teste", city: "São Paulo", region: "Sudeste", faturamento: 1, pendencias: 0, rpDone: 0, status: "green" }];
  db.manualEntries = [{ id: "entry_clear_test", tenant: "f_clear_test", type: "entrada", date: "2026-10-07", value: 1, desc: "Teste", catId: "teste", catName: "Teste", pay: "Teste", created: new Date().toISOString() }];
  await saveDatabase(db);

  const wrongConfirmation = await appRequest("POST", "/api/state/clear-operational", { Cookie: `gestao_session=${encodeURIComponent(token)}` }, { confirm: "APAGAR" });
  assert.equal(wrongConfirmation.status, 400);
  assert.equal(db.franchises.length, 1);

  const clearResponse = await appRequest("POST", "/api/state/clear-operational", { Cookie: `gestao_session=${encodeURIComponent(token)}` }, { confirm: "APAGAR DADOS OPERACIONAIS" });
  assert.equal(clearResponse.status, 200);
  assert.equal(db.franchises.length, 0);
  assert.equal(db.manualEntries.length, 0);
  assert.ok(db.users.some((user: any) => user.id === dono.id));
  assert.ok((db.intercompanyRules || []).length > 0);
  assert.equal(db.auditLogs[0].action, "CLEAR_OPERATIONAL_DATA");

  Object.assign(db, snapshot);
  await saveDatabase(db);
});

test("AUDITORIA 13: VT aceita lista vazia e parâmetros do DRE permanecem no estado confirmado", async () => {
  const snapshot = JSON.parse(JSON.stringify(db));
  const dono = db.users.find((user: any) => user.perfil === "dono")!;
  const credential = getCredential(db, dono.id)!;
  const token = createSignedSessionToken(dono.id, credential.version, true);

  const vtConfig = {
    title: "VT teste",
    period: "Mês Vigente",
    rate: 10,
    days: 22,
    format: "both",
    prefix: "VT",
    pix: true,
    notes: true,
    tenant: "dono",
    employees: [{ id: "vt_regression", nome: "Colaborador", mat: "1", setor: "Teste", operadora: "PIX", tarifaIda: 5, tarifaVolta: 5, diasPrevistos: 22, faltas: 0, salarioBase: 2000 }],
  };

  const first = await appRequest(
    "POST",
    "/api/state/sync",
    { Cookie: `gestao_session=${encodeURIComponent(token)}` },
    { section: "vtConfigs", data: { dono: vtConfig } },
  );
  assert.equal(first.status, 200);
  assert.equal(first.body.state.vtConfigs.dono.employees.length, 1);

  const deleted = await appRequest(
    "POST",
    "/api/state/sync",
    { Cookie: `gestao_session=${encodeURIComponent(token)}` },
    { section: "vtConfigs", data: { dono: { ...vtConfig, employees: [] } } },
  );
  assert.equal(deleted.status, 200);
  assert.deepEqual(deleted.body.state.vtConfigs.dono.employees, []);

  const dre = await appRequest(
    "POST",
    "/api/state/sync",
    { Cookie: `gestao_session=${encodeURIComponent(token)}` },
    { section: "dreParams", data: { dono: { impostos: 0.1, cmv: 0.2, fees: 0.03, discount: 0, despesas: { aluguel: 0.04 } } } },
  );
  assert.equal(dre.status, 200);
  assert.equal(dre.body.state.dreParams.dono.impostos, 0.1);

  Object.assign(db, snapshot);
  await saveDatabase(db);
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
