import { base64Url, sha256 } from "../../lib/sha256";
import { secureRandomHex } from "../../platform/secureRandom";
import { keychainDelete, keychainGet, keychainSet } from "../../platform/keychain";

export type UniverseAccount = {
  id: string;
  name: string;
  email: string;
  picture: null;
  createdAt: number;
  signedInAt: number;
};

type StoredAccount = {
  id: string;
  name: string;
  email: string;
  salt: string;
  passwordHash: string;
  createdAt: number;
};

export const UNIVERSE_ACCOUNTS_KEY = "universe-browser-accounts";
export const UNIVERSE_SESSION_KEY = "universe-browser-account";
const MIN_PASSWORD_LENGTH = 8;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function hashPassword(salt: string, password: string): string {
  return base64Url(sha256(`${salt}:${password}`));
}

export function isUniverseAccount(value: unknown): value is UniverseAccount {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.name === "string" &&
    record.name.length > 0 &&
    typeof record.email === "string" &&
    record.email.length > 0 &&
    typeof record.createdAt === "number"
  );
}

const readJson = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await keychainGet(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => keychainSet(key, JSON.stringify(value));

export async function readAccounts(): Promise<Record<string, StoredAccount>> {
  const accounts = await readJson<Record<string, StoredAccount>>(UNIVERSE_ACCOUNTS_KEY);
  return accounts ?? {};
}

export async function createUniverseAccount(input: { name: string; email: string; password: string }): Promise<{ account: UniverseAccount } | { error: string }> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (!name) return { error: "Enter your name." };
  if (!isValidEmail(email)) return { error: "Enter a valid email address." };
  if (input.password.length < MIN_PASSWORD_LENGTH) return { error: `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.` };
  const accounts = await readAccounts();
  if (accounts[email]) return { error: "An account with this email already exists. Sign in instead." };
  const salt = secureRandomHex(32);
  const stored: StoredAccount = {
    id: secureRandomHex(32),
    name,
    email,
    salt,
    passwordHash: hashPassword(salt, input.password),
    createdAt: Date.now(),
  };
  accounts[email] = stored;
  await writeJson(UNIVERSE_ACCOUNTS_KEY, accounts);
  const account: UniverseAccount = { id: stored.id, name, email, picture: null, createdAt: stored.createdAt, signedInAt: Date.now() };
  await writeJson(UNIVERSE_SESSION_KEY, { profile: account });
  return { account };
}

export async function verifyUniverseAccount(input: { email: string; password: string }): Promise<{ account: UniverseAccount } | { error: string }> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return { error: "Enter a valid email address." };
  const accounts = await readAccounts();
  const stored = accounts[email];
  if (!stored) return { error: "No UniVerse account with this email. Create one instead." };
  if (hashPassword(stored.salt, input.password) !== stored.passwordHash) return { error: "Wrong password for this account." };
  const account: UniverseAccount = { id: stored.id, name: stored.name, email: stored.email, picture: null, createdAt: stored.createdAt, signedInAt: Date.now() };
  await writeJson(UNIVERSE_SESSION_KEY, { profile: account });
  return { account };
}

export async function readSession(): Promise<UniverseAccount | null> {
  const session = await readJson<{ profile?: unknown }>(UNIVERSE_SESSION_KEY);
  if (!session || !isUniverseAccount(session.profile)) return null;
  return session.profile;
}

export async function clearSession(): Promise<void> {
  await keychainDelete(UNIVERSE_SESSION_KEY);
}
