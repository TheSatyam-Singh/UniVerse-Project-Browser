export type FilterListCategory = "ads" | "privacy" | "malware" | "annoyances" | "regional" | "social";

export type FilterListEntry = {
  name: string;
  url: string;
  filename: string;
  minBytes: number;
  maxBytes: number;
  category: FilterListCategory;
  isOptional: boolean;
  isTrusted: boolean;
};

export const DEFAULT_FILTER_LISTS: readonly FilterListEntry[] = [
  { name: "EasyList", url: "https://easylist.to/easylist/easylist.txt", filename: "easylist.txt", minBytes: 100000, maxBytes: 10000000, category: "ads", isOptional: false, isTrusted: false },
  { name: "EasyPrivacy", url: "https://easylist.to/easylist/easyprivacy.txt", filename: "easyprivacy.txt", minBytes: 50000, maxBytes: 5000000, category: "privacy", isOptional: false, isTrusted: false },
  { name: "Peter Lowe's", url: "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0&mimetype=plaintext", filename: "peter-lowes.txt", minBytes: 10000, maxBytes: 2000000, category: "ads", isOptional: false, isTrusted: false },
  { name: "uBlock Filters", url: "https://ublockorigin.github.io/uAssetsCDN/filters/filters.min.txt", filename: "ublock-filters.min.txt", minBytes: 50000, maxBytes: 5000000, category: "ads", isOptional: false, isTrusted: true },
  { name: "uBlock Unbreak", url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/unbreak.txt", filename: "ublock-unbreak.txt", minBytes: 5000, maxBytes: 2000000, category: "ads", isOptional: false, isTrusted: true },
  { name: "uBlock Badware", url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt", filename: "ublock-badware.txt", minBytes: 5000, maxBytes: 2000000, category: "malware", isOptional: false, isTrusted: true },
  { name: "uBlock Privacy", url: "https://ublockorigin.github.io/uAssetsCDN/filters/privacy.min.txt", filename: "ublock-privacy.min.txt", minBytes: 5000, maxBytes: 2000000, category: "privacy", isOptional: false, isTrusted: true },
  { name: "uBlock Quick Fixes", url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/quick-fixes.txt", filename: "ublock-quick-fixes.txt", minBytes: 1000, maxBytes: 2000000, category: "ads", isOptional: false, isTrusted: true },
  { name: "AdGuard URL Tracking Protection", url: "https://filters.adtidy.org/extension/ublock/filters/17.txt", filename: "adguard-url-tracking.txt", minBytes: 20000, maxBytes: 5000000, category: "privacy", isOptional: false, isTrusted: false },
  { name: "Online Malicious URL Blocklist", url: "https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-online.txt", filename: "urlhaus-filter.txt", minBytes: 10000, maxBytes: 30000000, category: "malware", isOptional: false, isTrusted: false },
];

export const OPTIONAL_FILTER_LISTS: readonly FilterListEntry[] = [
  { name: "AdGuard Annoyances", url: "https://filters.adtidy.org/extension/ublock/filters/14.txt", filename: "adguard-annoyances.txt", minBytes: 10000, maxBytes: 5000000, category: "annoyances", isOptional: true, isTrusted: false },
  { name: "uBlock Annoyances (cookies)", url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances-cookies.txt", filename: "ublock-annoyances-cookies.txt", minBytes: 1000, maxBytes: 2000000, category: "annoyances", isOptional: true, isTrusted: false },
  { name: "uBlock Annoyances (others)", url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances-others.txt", filename: "ublock-annoyances-others.txt", minBytes: 1000, maxBytes: 2000000, category: "annoyances", isOptional: true, isTrusted: false },
  { name: "EasyList Cookie", url: "https://secure.fanboy.co.nz/fanboy-cookiemonster.txt", filename: "easylist-cookie.txt", minBytes: 10000, maxBytes: 5000000, category: "annoyances", isOptional: true, isTrusted: false },
  { name: "Fanboy's Annoyance", url: "https://secure.fanboy.co.nz/fanboy-annoyance.txt", filename: "fanboy-annoyance.txt", minBytes: 10000, maxBytes: 5000000, category: "annoyances", isOptional: true, isTrusted: false },
  { name: "Fanboy's Social", url: "https://easylist.to/easylist/fanboy-social.txt", filename: "fanboy-social.txt", minBytes: 5000, maxBytes: 5000000, category: "social", isOptional: true, isTrusted: false },
  { name: "AdGuard Base", url: "https://filters.adtidy.org/extension/ublock/filters/2.txt", filename: "adguard-base.txt", minBytes: 50000, maxBytes: 10000000, category: "ads", isOptional: true, isTrusted: false },
  { name: "AdGuard Mobile Ads", url: "https://filters.adtidy.org/extension/ublock/filters/11.txt", filename: "adguard-mobile.txt", minBytes: 5000, maxBytes: 5000000, category: "ads", isOptional: true, isTrusted: false },
  { name: "AdGuard Tracking Protection", url: "https://filters.adtidy.org/extension/ublock/filters/3.txt", filename: "adguard-tracking.txt", minBytes: 10000, maxBytes: 5000000, category: "privacy", isOptional: true, isTrusted: false },
  { name: "AdGuard Chinese", url: "https://filters.adtidy.org/extension/ublock/filters/224.txt", filename: "adguard-chinese.txt", minBytes: 5000, maxBytes: 5000000, category: "regional", isOptional: true, isTrusted: false },
  { name: "AdGuard Japanese", url: "https://filters.adtidy.org/extension/ublock/filters/7.txt", filename: "adguard-japanese.txt", minBytes: 5000, maxBytes: 5000000, category: "regional", isOptional: true, isTrusted: false },
  { name: "AdGuard French", url: "https://filters.adtidy.org/extension/ublock/filters/16.txt", filename: "adguard-french.txt", minBytes: 5000, maxBytes: 5000000, category: "regional", isOptional: true, isTrusted: false },
  { name: "AdGuard German", url: "https://filters.adtidy.org/extension/ublock/filters/6.txt", filename: "adguard-german.txt", minBytes: 5000, maxBytes: 5000000, category: "regional", isOptional: true, isTrusted: false },
  { name: "AdGuard Russian", url: "https://filters.adtidy.org/extension/ublock/filters/1.txt", filename: "adguard-russian.txt", minBytes: 10000, maxBytes: 10000000, category: "regional", isOptional: true, isTrusted: false },
  { name: "AdGuard Spanish/Portuguese", url: "https://filters.adtidy.org/extension/ublock/filters/9.txt", filename: "adguard-spanish.txt", minBytes: 5000, maxBytes: 5000000, category: "regional", isOptional: true, isTrusted: false },
  { name: "AdGuard Turkish", url: "https://filters.adtidy.org/extension/ublock/filters/13.txt", filename: "adguard-turkish.txt", minBytes: 5000, maxBytes: 5000000, category: "regional", isOptional: true, isTrusted: false },
  { name: "IndianList", url: "https://raw.githubusercontent.com/nickspaargaren/IndianList/master/IndianList.txt", filename: "indianlist.txt", minBytes: 1000, maxBytes: 5000000, category: "regional", isOptional: true, isTrusted: false },
  { name: "KoreanList", url: "https://raw.githubusercontent.com/nickspaargaren/Korean-Adblock-List/master/koreanlist.txt", filename: "koreanlist.txt", minBytes: 1000, maxBytes: 5000000, category: "regional", isOptional: true, isTrusted: false },
];

export const ALL_FILTER_LISTS: readonly FilterListEntry[] = [...DEFAULT_FILTER_LISTS, ...OPTIONAL_FILTER_LISTS];

export const FILTER_LISTS_DIR = "packages/universecore/vendor/filter-lists";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export function filterListUpdateIntervalMs(headerText: string): number {
  const fallback = 24 * HOUR_MS;
  for (const line of headerText.split("\n").slice(0, 40)) {
    if (!line.startsWith("!")) {
      if (!line.startsWith("[")) break;
      continue;
    }
    const at = line.toLowerCase().indexOf("expires:");
    if (at < 0) continue;
    const parts = line.slice(at + "expires:".length).trim().split(/\s+/);
    const n = Number(parts[0]);
    if (parts.length < 2 || !Number.isFinite(n)) break;
    const unit = parts[1]!;
    const seconds = unit.startsWith("hour") ? n * HOUR_MS : unit.startsWith("day") ? n * DAY_MS : fallback;
    return Math.min(Math.max(seconds, HOUR_MS), 7 * DAY_MS);
  }
  return fallback;
}

export function filterListUpdateDue(lastCheckedMs: number | null, headerText: string, nowMs = Date.now()): boolean {
  if (lastCheckedMs === null) return true;
  return nowMs - lastCheckedMs >= filterListUpdateIntervalMs(headerText);
}

export function filterListLooksValid(text: string, entry: FilterListEntry): boolean {
  if (text.length < entry.minBytes || text.length > entry.maxBytes) return false;
  const first = text.split("\n").find((line) => line.trim() !== "");
  return !!first && (first.startsWith("[") || first.startsWith("!") || first.startsWith("#"));
}

export function enabledFilterLists(enabledOptionalFilenames: readonly string[]): FilterListEntry[] {
  const enabled = new Set(enabledOptionalFilenames);
  return [...DEFAULT_FILTER_LISTS, ...OPTIONAL_FILTER_LISTS.filter((l) => enabled.has(l.filename))];
}
