import { create } from "zustand";
import { folderInfo, stopSync, syncNow, turnOnSync, useSync } from "../sync/engine";
import { clearSession, createUniverseAccount, readSession, verifyUniverseAccount, type UniverseAccount } from "./universeAccount";

export type BrowserAccount = UniverseAccount;

type AccountState = {
  account: BrowserAccount | null;
  status: "signedOut" | "signingIn" | "signedIn";
  error: string | null;
};

export const useAccount = create<AccountState>()(() => ({
  account: null,
  status: "signedOut",
  error: null,
}));

export async function restoreAccount(): Promise<void> {
  const account = await readSession();
  if (!account) return;
  useAccount.setState({ account, status: "signedIn", error: null });
}

export function accountError(error: string | null): void {
  useAccount.setState({ error });
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<void> {
  if (useAccount.getState().status === "signingIn") return;
  useAccount.setState({ status: "signingIn", error: null });
  const result = await createUniverseAccount(input);
  if ("error" in result) {
    useAccount.setState({ status: "signedOut", error: result.error });
    return;
  }
  useAccount.setState({ account: result.account, status: "signedIn", error: null });
  await enableSyncForAccount();
}

export async function signIn(input: { email: string; password: string }): Promise<void> {
  if (useAccount.getState().status === "signingIn") return;
  useAccount.setState({ status: "signingIn", error: null });
  const result = await verifyUniverseAccount(input);
  if ("error" in result) {
    useAccount.setState({ status: "signedOut", error: result.error });
    return;
  }
  useAccount.setState({ account: result.account, status: "signedIn", error: null });
  await enableSyncForAccount();
}

export async function signOut(options: { deleteSyncedData?: boolean } = {}): Promise<void> {
  const hadAccount = !!useAccount.getState().account;
  await clearSession();
  useAccount.setState({ account: null, status: "signedOut", error: null });
  if (hadAccount && useSync.getState().enabled) {
    await stopSync({ deleteData: !!options.deleteSyncedData });
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
