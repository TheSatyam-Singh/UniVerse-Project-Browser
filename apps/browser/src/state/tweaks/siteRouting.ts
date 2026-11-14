import { bestSiteRule, dropDeadRoutingRules, isLikelyOAuthUrl, newSiteRoutingRule, type SiteRoutingRule } from "@universe/tweaks";
import { currentTweaks, updateTweaks } from "./tweaks";

export type { SiteRoutingRule };

export type SiteRouteWindow = { id: string; kind: string; profileId: string };

export type SiteRouteBrowser = {
  profiles: Record<string, unknown>;
  windows: Record<string, SiteRouteWindow>;
  focusedWindowId: string | null;
  newTab(windowId: string, options: { url: string; profileId: string }): void;
  focus(windowId: string): void;
};

export function siteRoutingRules(): SiteRoutingRule[] {
  return currentTweaks().siteRoutingRules;
}

export function resolveSiteRoute(url: string, rules: SiteRoutingRule[] = siteRoutingRules()): SiteRoutingRule | null {
  return bestSiteRule(url, rules);
}

export function addSiteRoutingRule(domain: string, targetProfileId: string, pathPrefix?: string): SiteRoutingRule | null {
  const rule = newSiteRoutingRule(domain, targetProfileId, pathPrefix);
  if (!rule) return null;
  updateTweaks({ siteRoutingRules: [...siteRoutingRules(), rule] });
  return rule;
}

export function updateSiteRoutingRule(rule: SiteRoutingRule) {
  updateTweaks({ siteRoutingRules: siteRoutingRules().map((r) => (r.id === rule.id ? rule : r)) });
}

export function deleteSiteRoutingRule(id: string) {
  updateTweaks({ siteRoutingRules: siteRoutingRules().filter((r) => r.id !== id) });
}

export function dropDeadSiteRoutingRules(profileIds: ReadonlySet<string>) {
  const { rules, changed } = dropDeadRoutingRules(siteRoutingRules(), profileIds);
  if (changed) updateTweaks({ siteRoutingRules: rules });
}

export function applySiteRoute(url: string, browser: SiteRouteBrowser, windowId?: string): boolean {
  if (isLikelyOAuthUrl(url)) return false;
  const rule = resolveSiteRoute(url);
  if (!rule) return false;
  const target = windowId ?? browser.focusedWindowId;
  if (!target) return false;
  const window = browser.windows[target];
  if (!window || window.kind === "private" || !browser.profiles[rule.targetProfileId]) return false;
  browser.newTab(target, { url, profileId: rule.targetProfileId });
  browser.focus(target);
  return true;
}
