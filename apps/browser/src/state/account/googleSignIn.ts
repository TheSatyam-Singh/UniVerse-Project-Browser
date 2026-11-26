import { useBrowser } from "../browser/store";
import { endpoints, form } from "../live/net";
import { secureRandomHex } from "../../platform/secureRandom";
import { base64Url, sha256 } from "../../lib/sha256";

export const OAUTH_REDIRECT = "http://127.0.0.1:53682/universe-oauth";
export const OAUTH_SCOPE = "openid profile email";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const TOKEN_LEEWAY_MS = 60_000;

export type GoogleProfile = {
  id: string;
  name: string;
  email: string;
  picture: string | null;
};

export type GoogleSignInResult = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  profile: GoogleProfile;
};

export function buildAuthUrl(clientId: string, verifier: string, state: string): string {
  return `${endpoints.googleAuth}?${form({
    client_id: clientId.trim(),
    redirect_uri: OAUTH_REDIRECT,
    response_type: "code",
    scope: OAUTH_SCOPE,
    code_challenge: base64Url(sha256(verifier)),
    code_challenge_method: "S256",
    state,
    access_type: "offline",
    prompt: "consent",
  })}`;
}

export function parseAuthRedirect(url: string, expectedState: string): { code: string } | { error: string } {
  const search = url.split("#")[0]!.split("?")[1] ?? "";
  const params = new Map(
    search
      .split("&")
      .filter(Boolean)
      .map((pair) => pair.split("=").map((v) => decodeURIComponent(v.replace(/\+/g, " "))) as [string, string]),
  );
  if (params.get("state") !== expectedState) return { error: "Sign-in didn't match this request" };
  const code = params.get("code");
  if (!code) return { error: params.get("error") ?? "Google didn't grant access" };
  return { code };
}

export function profileFromUserinfo(json: unknown): GoogleProfile | null {
  if (!json || typeof json !== "object") return null;
  const sub = (json as { sub?: unknown }).sub;
  const email = (json as { email?: unknown }).email;
  if (typeof sub !== "string" || !sub || typeof email !== "string" || !email) return null;
  const name = (json as { name?: unknown }).name;
  const picture = (json as { picture?: unknown }).picture;
  return {
    id: sub,
    name: typeof name === "string" && name ? name : email,
    email,
    picture: typeof picture === "string" && picture ? picture : null,
  };
}

export function isTokenExpired(expiresAt: number, now = Date.now()): boolean {
  return now + TOKEN_LEEWAY_MS >= expiresAt;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function exchangeCode(clientId: string, code: string, verifier: string): Promise<TokenResponse> {
  const res = await fetch(endpoints.googleToken, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form({ client_id: clientId.trim(), code, code_verifier: verifier, grant_type: "authorization_code", redirect_uri: OAUTH_REDIRECT }),
  });
  const json = (await res.json().catch(() => null)) as TokenResponse | null;
  if (!res.ok || !json) throw new Error(json?.error_description ?? json?.error ?? `Google sign-in failed (${res.status})`);
  return json;
}

export async function refreshGoogleTokens(
  clientId: string,
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: number }> {
  const res = await fetch(endpoints.googleToken, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form({ client_id: clientId.trim(), refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const json = (await res.json().catch(() => null)) as TokenResponse | null;
  if (!res.ok || !json?.access_token) throw new Error(json?.error_description ?? json?.error ?? `Couldn't refresh the sign-in (${res.status})`);
  return { accessToken: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
}

export function startGoogleSignIn(windowId: string, clientId: string): Promise<GoogleSignInResult> {
  const verifier = secureRandomHex(64);
  const state = secureRandomHex(32);
  const url = buildAuthUrl(clientId, verifier, state);
  const tabId = useBrowser.getState().newTab(windowId, { url });
  return new Promise<GoogleSignInResult>((resolve, reject) => {
    const stop = useBrowser.subscribe((s, prev) => {
      if (s.tabs === prev.tabs) return;
      const tab = s.tabs[tabId];
      if (!tab) return finish(new Error("Sign-in was cancelled"));
      if (!tab.url.startsWith(OAUTH_REDIRECT)) return;
      const parsed = parseAuthRedirect(tab.url, state);
      stop();
      useBrowser.getState().closeTab(tabId);
      if ("error" in parsed) return finish(new Error(parsed.error));
      void completeSignIn(clientId, parsed.code, verifier).then(resolve, finish);
    });
    const finish = (error?: unknown) => {
      stop();
      if (error) reject(error instanceof Error ? error : new Error(String(error)));
    };
  });
}

async function completeSignIn(clientId: string, code: string, verifier: string): Promise<GoogleSignInResult> {
  const tokens = await exchangeCode(clientId, code, verifier);
  if (!tokens.access_token || !tokens.refresh_token) throw new Error("Google didn't return a sign-in token");
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" } });
  const profile = profileFromUserinfo(await res.json().catch(() => null));
  if (!profile) throw new Error("Google didn't return an account");
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    profile,
  };
}
