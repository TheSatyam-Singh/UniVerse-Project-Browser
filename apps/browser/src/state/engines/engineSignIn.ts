import { importWebKitCookies, webKitCookieStoreKey } from "../../platform/webkit";
import type { PageCookie } from "../../platform/webkit";
import type { WebViewHandle } from "../../platform/tabs";
import { useBrowser } from "../browser/store";
import { tabEngine } from "./engines";
import { engineProfile } from "../browser/model";
import { carriableCookies, cookieAddresses } from "./signInCookies";
import { webviews } from "../../platform/webviews";
import { switchOverride } from "../../platform/launchConfig";
import { withDeadline } from "../../lib/deadline";

const CARRY_DEADLINE_MS = 1500;

let carryOn: boolean | undefined;

export const signInCarryOn = () => (carryOn ??= switchOverride("webkitSignIn") ?? true);

function stillChromiumPage(tabId: string, profile: string, web: WebViewHandle) {
  const s = useBrowser.getState();
  const t = s.tabs[tabId];
  return !!t && engineProfile(s, t.profileId) === profile && webviews.get(tabId) === web && tabEngine(s, tabId) === "chromium";
}

async function copyCookies(tabId: string, url: string): Promise<number> {
  const t = useBrowser.getState().tabs[tabId];
  const web = webviews.get(tabId);
  const urls = cookieAddresses(url);
  if (!t || !web || !urls.length) return 0;
  const profile = engineProfile(useBrowser.getState(), t.profileId);
  if (!stillChromiumPage(tabId, profile, web)) return 0;
  const storeKey = await webKitCookieStoreKey(profile);
  if (storeKey == null || !stillChromiumPage(tabId, profile, web)) return 0;
  const cookies = carriableCookies(await web.pageCookies(urls), Date.now() / 1000);
  if (!cookies.length || !stillChromiumPage(tabId, profile, web)) return 0;
  return importWebKitCookies(profile, storeKey, cookies);
}

export function carrySignInToWebKit(tabId: string, url: string): Promise<number> {
  if (!signInCarryOn()) return Promise.resolve(0);
  return withDeadline(copyCookies(tabId, url).catch(() => 0), CARRY_DEADLINE_MS, 0);
}

function stillWebKitPage(tabId: string, profile: string, web: WebViewHandle) {
  const s = useBrowser.getState();
  const t = s.tabs[tabId];
  return !!t && engineProfile(s, t.profileId) === profile && webviews.get(tabId) === web && tabEngine(s, tabId) === "webkit";
}

export async function readSignInCookies(tabId: string, url: string): Promise<PageCookie[]> {
  const t = useBrowser.getState().tabs[tabId];
  const web = webviews.get(tabId);
  const urls = cookieAddresses(url);
  if (!t || !web || !urls.length) return [];
  const profile = engineProfile(useBrowser.getState(), t.profileId);
  if (!stillWebKitPage(tabId, profile, web)) return [];
  const cookies = carriableCookies(await web.pageCookies(urls), Date.now() / 1000);
  if (!cookies.length || !stillWebKitPage(tabId, profile, web)) return [];
  return cookies;
}

const CHROMIUM_WAIT_MS = 3000;

async function waitForChromiumWebview(tabId: string, oldWeb: WebViewHandle | undefined): Promise<WebViewHandle | null> {
  const start = Date.now();
  while (Date.now() - start < CHROMIUM_WAIT_MS) {
    const s = useBrowser.getState();
    const web = webviews.get(tabId);
    if (web && web !== oldWeb && s.tabs[tabId] && tabEngine(s, tabId) === "chromium") return web;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

export async function carrySignInToChromium(tabId: string, cookies: PageCookie[], oldWeb: WebViewHandle | undefined): Promise<number> {
  if (!cookies.length) return 0;
  const web = await waitForChromiumWebview(tabId, oldWeb);
  if (!web) return 0;
  const s = useBrowser.getState();
  if (!s.tabs[tabId] || tabEngine(s, tabId) !== "chromium") return 0;
  const imported = await web.importCookies(cookies).catch(() => 0);
  if (imported > 0) await web.reload().catch(() => undefined);
  return imported;
}
