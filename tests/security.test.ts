import test from "node:test";
import assert from "node:assert/strict";
import {
  createMfaChallenge,
  createSignedSessionToken,
  createTotpSecret,
  configureSessionSecretFallback,
  hashPassword,
  migrateLegacyCredentials,
  totpCode,
  verifyTotp,
  verifyMfaChallenge,
  verifyPassword,
  verifySignedSessionToken,
} from "../src/serverSecurity";

test("hash scrypt nunca guarda a senha em texto e verifica corretamente", () => {
  const password = "Senha-Forte-de-Teste-2026!";
  const hash = hashPassword(password);
  assert.match(hash, /^scrypt\$/);
  assert.ok(!hash.includes(password));
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword("senha-incorreta", hash), false);
  assert.equal(verifyPassword(password, password), false);
});

test("migração invalida credenciais antigas e remove campos de senha dos usuários", () => {
  const result = migrateLegacyCredentials({ users: [{ id: "u1", login: "dono", pass: "senha-antiga" }], employees: [{ id: "e1", accessPassword: "antiga" }] });
  assert.equal(result.changed, true);
  assert.equal("pass" in result.database.users[0], false);
  assert.equal("accessPassword" in result.database.employees[0], false);
  assert.equal(result.database.credentials.u1.mustReset, true);
  assert.equal(result.database.credentials.u1.passwordHash, undefined);
});

test("sessão assinada expira e a assinatura não pode ser forjada", () => {
  const token = createSignedSessionToken("u1", 3, false);
  const decoded = verifySignedSessionToken(token);
  assert.equal(decoded?.sub, "u1");
  assert.equal(decoded?.cv, 3);
  assert.equal(verifySignedSessionToken(`${token}x`), null);
});

test("fallback de sessão em produção usa somente hash persistido, nunca senha fixa", () => {
  const previousSecret = process.env.FRANQUIAS_SESSION_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;
  const passwordHash = hashPassword("Senha-Forte-de-Teste-2026!");
  delete process.env.FRANQUIAS_SESSION_SECRET;
  process.env.NODE_ENV = "production";
  configureSessionSecretFallback([passwordHash]);
  try {
    const token = createSignedSessionToken("u1", 1, true);
    assert.equal(verifySignedSessionToken(token)?.sub, "u1");
  } finally {
    configureSessionSecretFallback(null);
    if (previousSecret === undefined) delete process.env.FRANQUIAS_SESSION_SECRET;
    else process.env.FRANQUIAS_SESSION_SECRET = previousSecret;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("desafio MFA aceita o código TOTP do intervalo atual", () => {
  const secret = createTotpSecret();
  const challenge = createMfaChallenge("u1", "mfa-setup");
  const decoded = verifyMfaChallenge(challenge);
  assert.deepEqual(decoded, { sub: "u1", purpose: "mfa-setup" });
  assert.match(totpCode(secret), /^\d{6}$/);
  assert.equal(verifyTotp(secret, totpCode(secret)), true);
  assert.equal(verifyTotp(secret, "000000"), false);
});
