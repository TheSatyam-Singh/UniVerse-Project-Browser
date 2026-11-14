import { arcRouteToSiteRule, type SiteRoutingRule } from "@universe/tweaks";
import type { ArcArchivedItem, ArcRoute, BookmarkNode } from "@universe/import";
import { addSiteRoutingRule, siteRoutingRules } from "../tweaks/siteRouting";
import { useBrowser } from "../browser/store";
import { hostOfUrl, type ArchiveItem, type ArchiveReason } from "../archive/archive";

export const ARC_ARCHIVE_RETENTION_DAYS = 30;

export type ArcArchiveEntry = {
  spaceId: string;
  url: string;
  title: string;
  archivedAt: number;
  auto: boolean;
};

export function countArcFolders(nodes: readonly BookmarkNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type !== "folder") continue;
    count += 1 + countArcFolders(node.children ?? []);
  }
  return count;
}

export function arcRoutesToSiteRules(
  routes: readonly ArcRoute[],
  spaceProfileIds: ReadonlyMap<string, string>,
  existing: SiteRoutingRule[],
): { added: SiteRoutingRule[]; skipped: number } {
  const all = [...existing];
  const added: SiteRoutingRule[] = [];
  let skipped = 0;
  for (const route of routes) {
    const converted = arcRouteToSiteRule(route.pattern, route.spaceID, spaceProfileIds, all, () => "");
    if ("skipped" in converted) {
      skipped += 1;
      continue;
    }
    all.push(converted.rule);
    added.push(converted.rule);
  }
  return { added, skipped };
}

export function applyArcRoutes(
  routes: readonly ArcRoute[],
  spaceProfileIds: ReadonlyMap<string, string>,
): { added: number; skipped: number } {
  const existing = siteRoutingRules();
  const { added, skipped } = arcRoutesToSiteRules(routes, spaceProfileIds, existing);
  for (const rule of added) addSiteRoutingRule(rule.domain, rule.targetProfileId, rule.pathPrefix);
  return { added: added.length, skipped };
}

export function arcArchiveEntries(
  items: readonly ArcArchivedItem[],
  spaceProfileIds: ReadonlyMap<string, string>,
  existing: readonly { url: string; archivedAt: number }[],
  now = Date.now(),
): ArcArchiveEntry[] {
  const cutoff = now - ARC_ARCHIVE_RETENTION_DAYS * 86_400_000;
  const seen = new Set(existing.map((entry) => `${entry.url}\n${entry.archivedAt}`));
  const out: ArcArchiveEntry[] = [];
  for (const item of items) {
    const archivedAt = item.archivedAt * 1000;
    if (archivedAt < cutoff) continue;
    const spaceId = spaceProfileIds.get(item.spaceID);
    if (!spaceId) continue;
    let url: URL;
    try {
      url = new URL(item.url);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    const key = `${item.url}\n${archivedAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ spaceId, url: item.url, title: item.title, archivedAt, auto: item.auto });
  }
  return out;
}

export function applyArcArchive(
  items: readonly ArcArchivedItem[],
  spaceProfileIds: ReadonlyMap<string, string>,
): { archived: number; skipped: number } {
  const s = useBrowser.getState();
  const existing = s.archiveEntries.flatMap((entry) => entry.items.map((item) => ({ url: item.url, archivedAt: entry.archivedAt })));
  const entries = arcArchiveEntries(items, spaceProfileIds, existing);
  for (const entry of entries) {
    const item: ArchiveItem = {
      id: `arc:${entry.archivedAt}:${entry.url}`,
      title: entry.title || entry.url,
      url: entry.url,
      host: hostOfUrl(entry.url),
      profileId: entry.spaceId,
    };
    const reason: ArchiveReason = entry.auto ? "auto" : "closed";
    s.archiveClosedTabs([item], entry.spaceId, reason, entry.archivedAt);
  }
  return { archived: entries.length, skipped: items.length - entries.length };
}

export function arcImportSummary(spaces: number, tabs: number, folders: number, rules: number, archived: number): string {
  const parts: [number, string][] = [
    [spaces, "space"],
    [tabs, "tab"],
    [folders, "folder"],
    [rules, "Air Traffic Control rule"],
    [archived, "archived tab"],
  ];
  const text = parts
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${count} ${label}${count === 1 ? "" : "s"}`);
  if (text.length === 0) return "";
  if (text.length === 1) return `${text[0]}.`;
  return `${text.slice(0, -1).join(", ")} and ${text[text.length - 1]}.`;
}
