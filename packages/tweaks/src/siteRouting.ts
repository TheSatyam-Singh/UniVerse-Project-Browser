export type SiteRoutingRule = {
  id: string;
  domain: string;
  pathPrefix?: string;
  targetProfileId: string;
  isEnabled: boolean;
  legacyProfileId?: string;
};

export function normalizeSiteDomain(input: string): string {
  let d = input.toLowerCase().trim();
  for (const prefix of ["https://", "http://"]) {
    if (d.startsWith(prefix)) d = d.slice(prefix.length);
  }
  if (d.startsWith("www.")) d = d.slice(4);
  const slash = d.indexOf("/");
  if (slash >= 0) d = d.slice(0, slash);
  return d;
}

export function newSiteRoutingRule(domain: string, targetProfileId: string, pathPrefix?: string): SiteRoutingRule | null {
  const normalized = normalizeSiteDomain(domain);
  if (!normalized || !targetProfileId) return null;
  return {
    id: `route-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    domain: normalized,
    ...(pathPrefix ? { pathPrefix } : {}),
    targetProfileId,
    isEnabled: true,
  };
}

export function siteRuleMatches(rule: SiteRoutingRule, url: string): boolean {
  if (!rule.isEnabled || !rule.domain) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== rule.domain && !host.endsWith(`.${rule.domain}`)) return false;
  return parsed.pathname.startsWith(rule.pathPrefix ?? "");
}

export function bestSiteRule(url: string, rules: SiteRoutingRule[]): SiteRoutingRule | null {
  let best: SiteRoutingRule | null = null;
  let bestScore: [number, number] | null = null;
  for (const rule of rules) {
    if (!siteRuleMatches(rule, url)) continue;
    const score: [number, number] = [rule.domain.length, rule.pathPrefix?.length ?? 0];
    if (!bestScore || score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1])) {
      best = rule;
      bestScore = score;
    }
  }
  return best;
}

export function dropDeadRoutingRules(
  rules: SiteRoutingRule[],
  liveProfileIds: ReadonlySet<string>,
): { rules: SiteRoutingRule[]; changed: boolean } {
  let changed = false;
  const updated: SiteRoutingRule[] = [];
  for (const rule of rules) {
    if (liveProfileIds.has(rule.targetProfileId)) {
      updated.push(rule);
      continue;
    }
    if (rule.legacyProfileId && liveProfileIds.has(rule.legacyProfileId)) {
      changed = true;
      const { legacyProfileId: _dropped, ...rest } = rule;
      updated.push({ ...rest, targetProfileId: rule.legacyProfileId });
      continue;
    }
    changed = true;
  }
  return { rules: updated, changed };
}

export function arcRouteToSiteRule(
  pattern: string,
  spaceId: string,
  spaceProfileIds: ReadonlyMap<string, string>,
  existing: SiteRoutingRule[],
  makeId: () => string,
): { rule: SiteRoutingRule } | { skipped: true } {
  const text = pattern.trim();
  const withoutScheme = text.replace(/^https?:\/\//i, "");
  const slash = withoutScheme.indexOf("/");
  const rawHost = slash >= 0 ? withoutScheme.slice(0, slash) : withoutScheme;
  const path = slash >= 0 ? withoutScheme.slice(slash) : "";
  const host = rawHost.toLowerCase();
  const hostOk = /^([a-z0-9-]+\.)+[a-z0-9-]+$/.test(host);
  const pathOk = /^(\/[A-Za-z0-9._~%/-]*)?$/.test(path);
  const targetProfileId = spaceProfileIds.get(spaceId);
  if (!hostOk || !pathOk || !targetProfileId) return { skipped: true };
  const rule: SiteRoutingRule = {
    id: makeId(),
    domain: host,
    ...(path.length > 1 ? { pathPrefix: path } : {}),
    targetProfileId,
    isEnabled: true,
  };
  if (existing.some((r) => r.domain === rule.domain && (r.pathPrefix ?? undefined) === (rule.pathPrefix ?? undefined))) {
    return { skipped: true };
  }
  return { rule };
}
