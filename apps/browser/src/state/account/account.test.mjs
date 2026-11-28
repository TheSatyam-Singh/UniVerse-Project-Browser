import assert from "node:assert/strict";
import { test } from "node:test";

const keychain = new Map();
globalThis.acTestNativeModules = {
  UniVerseKeychain: {
    get: async (account) => keychain.get(account) ?? null,
    set: async (account, secret) => {
      keychain.set(account, secret);
      return true;
    },
    delete: async (account) => keychain.delete(account),
  },
};

const {
  UNIVERSE_ACCOUNTS_KEY,
  UNIVERSE_SESSION_KEY,
  clearSession,
  createUniverseAccount,
  hashPassword,
  isUniverseAccount,
  isValidEmail,
  normalizeEmail,
  readAccounts,
  readSession,
  verifyUniverseAccount,
} = await import("./universeAccount.ts");

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  Satyam@Example.COM "), "satyam@example.com");
});

test("isValidEmail accepts real addresses and rejects the rest", () => {
  assert.equal(isValidEmail("satyam@example.com"), true);
  assert.equal(isValidEmail("a@b.co"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("a@b"), false);
  assert.equal(isValidEmail("a b@c.com"), false);
  assert.equal(isValidEmail(""), false);
});

test("hashPassword is deterministic and salted", () => {
  assert.equal(hashPassword("salt-1", "hunter2"), hashPassword("salt-1", "hunter2"));
  assert.notEqual(hashPassword("salt-1", "hunter2"), hashPassword("salt-2", "hunter2"));
  assert.notEqual(hashPassword("salt-1", "hunter2"), hashPassword("salt-1", "hunter3"));
});

test("isUniverseAccount accepts a stored session and rejects a Google-shaped profile", () => {
  assert.equal(isUniverseAccount({ id: "1", name: "Satyam", email: "s@example.com", picture: null, createdAt: 1, signedInAt: 2 }), true);
  assert.equal(isUniverseAccount({ id: "123", name: "Satyam", email: "s@example.com", picture: "https://example.com/p.jpg", signedInAt: 2 }), false);
  assert.equal(isUniverseAccount(null), false);
  assert.equal(isUniverseAccount("nope"), false);
});

test("createUniverseAccount stores the account and signs it in", async () => {
  keychain.clear();
  const result = await createUniverseAccount({ name: "Satyam Singh", email: "Satyam@Example.com", password: "correct horse" });
  assert.ok("account" in result);
  assert.equal(result.account.name, "Satyam Singh");
  assert.equal(result.account.email, "satyam@example.com");
  assert.equal(result.account.picture, null);
  const stored = await readAccounts();
  assert.equal(Object.keys(stored).length, 1);
  assert.equal(stored["satyam@example.com"].name, "Satyam Singh");
  assert.notEqual(stored["satyam@example.com"].passwordHash, "correct horse");
  const session = await readSession();
  assert.equal(session?.email, "satyam@example.com");
  assert.equal(JSON.parse(keychain.get(UNIVERSE_SESSION_KEY)).profile.email, "satyam@example.com");
  assert.equal(keychain.has(UNIVERSE_ACCOUNTS_KEY), true);
});

test("createUniverseAccount rejects a duplicate email, a bad email, a short password and a blank name", async () => {
  keychain.clear();
  await createUniverseAccount({ name: "Satyam", email: "satyam@example.com", password: "correct horse" });
  assert.deepEqual(await createUniverseAccount({ name: "Other", email: "SATYAM@example.com", password: "correct horse" }), {
    error: "An account with this email already exists. Sign in instead.",
  });
  assert.deepEqual(await createUniverseAccount({ name: "Satyam", email: "not-an-email", password: "correct horse" }), {
    error: "Enter a valid email address.",
  });
  assert.deepEqual(await createUniverseAccount({ name: "Satyam", email: "new@example.com", password: "short" }), {
    error: "Choose a password of at least 8 characters.",
  });
  assert.deepEqual(await createUniverseAccount({ name: "   ", email: "new@example.com", password: "correct horse" }), {
    error: "Enter your name.",
  });
});

test("verifyUniverseAccount signs in with the right password and refuses the wrong one", async () => {
  keychain.clear();
  await createUniverseAccount({ name: "Satyam", email: "satyam@example.com", password: "correct horse" });
  await clearSession();
  assert.equal(await readSession(), null);
  const ok = await verifyUniverseAccount({ email: "satyam@example.com", password: "correct horse" });
  assert.ok("account" in ok);
  assert.equal(ok.account.email, "satyam@example.com");
  assert.equal((await readSession())?.email, "satyam@example.com");
  assert.deepEqual(await verifyUniverseAccount({ email: "satyam@example.com", password: "wrong horse" }), {
    error: "Wrong password for this account.",
  });
  assert.deepEqual(await verifyUniverseAccount({ email: "nobody@example.com", password: "correct horse" }), {
    error: "No UniVerse account with this email. Create one instead.",
  });
});

test("clearSession signs out without deleting the account", async () => {
  keychain.clear();
  await createUniverseAccount({ name: "Satyam", email: "satyam@example.com", password: "correct horse" });
  await clearSession();
  assert.equal(await readSession(), null);
  assert.equal(Object.keys(await readAccounts()).length, 1);
});
