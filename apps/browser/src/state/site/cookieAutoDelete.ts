import type { PageEngine } from "@universe/universecore";
import { clearSiteData } from "../../platform/siteSettings";
import { engineProfile } from "../browser/model";
import { isIncognitoProfile } from "../browser/model";
import { useBrowser } from "../browser/store";
import type { Tab } from "../browser/types";
import { tabEngine } from "../engines/engines";
import { noteCookieAutoDeleteSites } from "../telemetry/usage";
import { siteOrigin } from "./reloadMenu";

export type OpenSite = { host: string; profileId: string; engine: PageEngine };

const siteKey = (site: Pick<OpenSite, "host" | "profileId">) => `${site.profileId}\n${site.host.toLowerCase()}`;

export function openSitesOf(tabs: Record<string, Tab>, engineOfTab: (tabId: string) => PageEngine): Map<string, OpenSite> {
  const open = new Map<string, OpenSite>();
  for (const tab of Object.values(tabs)) {
    if (isIncognitoProfile(tab.profileId)) continue;
    const origin = siteOrigin(tab.url);
    if (!origin) continue;
    const host = new URL(origin).hostname;
    const key = siteKey({ host, profileId: tab.profileId });
    if (!open.has(key)) open.set(key, { host, profileId: tab.profileId, engine: engineOfTab(tab.id) });
  }
  return open;
}

export function vacatedSites(previous: Map<string, OpenSite>, current: Map<string, OpenSite>, keepHosts: string[]): OpenSite[] {
  const keep = new Set(keepHosts.map((host) => host.toLowerCase()));
  const vacated: OpenSite[] = [];
  for (const [key, site] of previous) {
    if (current.has(key)) continue;
    if (keep.has(site.host.toLowerCase())) continue;
    vacated.push(site);
  }
  return vacated;
}

export function startCookieAutoDelete() {
  const state = useBrowser.getState();
  let previous = openSitesOf(state.tabs, (tabId) => tabEngine(state, tabId));
  return useBrowser.subscribe((s, prev) => {
    if (s.tabs === prev.tabs && s.settings === prev.settings) return;
    const current = openSitesOf(s.tabs, (tabId) => tabEngine(s, tabId));
    if (!s.settings.autoDeleteCookies) {
      previous = current;
      return;
    }
    const vacated = vacatedSites(previous, current, s.settings.cookieKeepHosts);
    previous = current;
    if (!vacated.length) return;
    noteCookieAutoDeleteSites(vacated.length);
    for (const site of vacated) {
      void clearSiteData(engineProfile(s, site.profileId), `https://${site.host}`, site.engine).catch(() => {});
    }
  });
}
