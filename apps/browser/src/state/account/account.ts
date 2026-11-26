import { create } from "zustand";
import { keychainDelete, keychainGet, keychainSet } from "../../platform/keychain";
import { folderInfo, stopSync, syncNow, turnOnSync, useSync } from "../sync/engine";
import { isTokenExpired, refreshGoogleTokens, startGoogleSignIn, type GoogleProfile } from "./googleSignIn";

const ACCOUNT_KEY = "universe-browser-account";
const TOKENS_KEY = "universe-browser-account-tokens";

export type BrowserAccount = GoogleProfile & { signedInAt: number };

type AccountTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type AccountState = {
  account: BrowserAccount | null;
  clientId: string;
  status: "signedOut" | "signingIn" | "signedIn";
  error: string | null;
};

export const useAccount = create<AccountState>()(() => ({
  account: null,
  clientId: "",
  status: "signedOut",
  error: null,
}));

const readJson = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await keychainGet(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => keychainSet(key, JSON.stringify(value));

export async function restoreAccount(): Promise<void> {
  const meta = await readJson<{ profile?: BrowserAccount; clientId?: string }>(ACCOUNT_KEY);
  const tokens = await readJson<AccountTokens>(TOKENS_KEY);
  if (meta?.clientId) useAccount.setState({ clientId: meta.clientId });
  if (!meta?.profile || !tokens) return;
  if (!meta.clientId) {
    await keychainDelete(TOKENS_KEY);
    return;
  }
  if (isTokenExpired(tokens.expiresAt)) {
    try {
      const refreshed = await refreshGoogleTokens(meta.clientId, tokens.refreshToken);
      await writeJson(TOKENS_KEY, { ...tokens, accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt });
    } catch {
      await keychainDelete(TOKENS_KEY);
      return;
    }
  }
  useAccount.setState({ account: meta.profile, status: "signedIn", error: null });
}

export function setClientId(clientId: string): void {
  const trimmed = clientId.trim();
  useAccount.setState({ clientId: trimmed });
  void readJson<{ profile?: BrowserAccount; clientId?: string }>(ACCOUNT_KEY).then((meta) =>
    writeJson(ACCOUNT_KEY, { profile: meta?.profile ?? null, clientId: trimmed }),
  );
}

export function accountError(error: string | null): void {
  useAccount.setState({ error });
}

export async function signIn(windowId: string): Promise<void> {
  const clientId = useAccount.getState().clientId;
  if (!clientId) {
    useAccount.setState({ error: "Add your Google client ID first." });
    return;
  }
  if (useAccount.getState().status === "signingIn") return;
  useAccount.setState({ status: "signingIn", error: null });
  try {
    const result = await startGoogleSignIn(windowId, clientId);
    const account: BrowserAccount = { ...result.profile, signedInAt: Date.now() };
    await writeJson(ACCOUNT_KEY, { profile: account, clientId });
    await writeJson(TOKENS_KEY, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
    });
    useAccount.setState({ account, status: "signedIn", error: null });
    await enableSyncForAccount();
  } catch (error) {
    useAccount.setState({ status: "signedOut", error: error instanceof Error ? error.message : "Sign-in failed" });
  }
}

export async function signOut(options: { deleteSyncedData?: boolean } = {}): Promise<void> {
  const hadAccount = !!useAccount.getState().account;
  await keychainDelete(TOKENS_KEY);
  const meta = await readJson<{ profile?: BrowserAccount; clientId?: string }>(ACCOUNT_KEY);
  await writeJson(ACCOUNT_KEY, { profile: null, clientId: meta?.clientId ?? "" });
  useAccount.setState({ account: null, status: "signedOut", error: null });
  if (hadAccount && useSync.getState().enabled) {
    await stopSync({ deleteData: !!options.deleteSyncedData });
  }
}

export async function ensureAccessToken(): Promise<string | null> {
  const tokens = await readJson<AccountTokens>(TOKENS_KEY);
  const clientId = useAccount.getState().clientId;
  if (!tokens || !clientId) return null;
  if (!isTokenExpired(tokens.expiresAt)) return tokens.accessToken;
  try {
    const refreshed = await refreshGoogleTokens(clientId, tokens.refreshToken);
    await writeJson(TOKENS_KEY, { ...tokens, accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt });
    return refreshed.accessToken;
  } catch {
    return null;
  }
}

export async function enableSyncForAccount(): Promise<{ ok: true } | { error: string }> {
  if (useSync.getState().enabled) return { ok: true };
  const info = await folderInfo();
  if (!info) return { error: "Couldn't find a sync folder." };
  const result = await turnOnSync(info.path);
  if ("error" in result) return { error: result.error };
  return { ok: true };
}

export const refreshSyncNow = () => syncNow();
