import { everySlowly } from "../../platform/slowTimers";
import { webviews } from "../../platform/webviews";
import { useBrowser, type BrowserState } from "../browser/store";
import { activeTabId, isIncognitoProfile } from "../browser/model";
import type { Tab } from "../browser/types";
import { isInternalTab } from "../pages/urls";
import { isPeekTab } from "../peek/peek";
import { durationTitle } from "../../lib/time";
import { isSleeping } from "./sleepingTabs";

export const HIBERNATION_PRESETS: readonly number[] = [5, 15, 30, 60, 120];
export const NEVER_HIBERNATE = "never";
const SWEEP_MS = 60_000;

export function hibernationChoices(minutes: number | null): { value: string; title: string }[] {
  const own = minutes !== null && !HIBERNATION_PRESETS.includes(minutes) ? [{ minutes, title: durationTitle(minutes) }] : [];
  const sorted = [...HIBERNATION_PRESETS.map((m) => ({ minutes: m, title: durationTitle(m) })), ...own].sort((a, b) => a.minutes - b.minutes);
  return [...sorted.map((c) => ({ value: String(c.minutes), title: c.title })), { value: NEVER_HIBERNATE, title: "Never" }];
}

const hostOf = (url: string): string | null => {
  const match = /^[a-z][\w+.-]*:\/\/([^/?#:]*)/i.exec(url.trim());
  return match ? match[1]!.toLowerCase() : null;
};

export function isKeepActiveUrl(url: string, sites: readonly string[]): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return sites.some((site) => {
    const kept = hostOf(site) ?? site.toLowerCase().split("/")[0]!;
    return host === kept || host.endsWith(`.${kept}`);
  });
}

export function hibernatable(s: BrowserState, tabId: string, now = Date.now()): boolean {
  const idleMinutes = s.settings.memorySaverIdleMinutes;
  if (!s.settings.memorySaver || idleMinutes === null) return false;
  const tab: Tab | undefined = s.tabs[tabId];
  if (!tab || isSleeping(tabId) || !webviews.has(tabId)) return false;
  if (activeTabId(s, tab.windowId, tab.profileId) === tabId) return false;
  if (isPeekTab(s, tabId)) return false;
  if (isIncognitoProfile(tab.profileId)) return false;
  if (isInternalTab(tab)) return false;
  const live = s.live[tabId];
  if (live?.isLoading || live?.playingAudio) return false;
  if (isKeepActiveUrl(tab.url, s.settings.keepActiveSites ?? [])) return false;
  return now - tab.lastActiveAt >= idleMinutes * 60_000;
}

export async function sweepHibernation(now = Date.now()): Promise<string[]> {
  const s = useBrowser.getState();
  const hibernated: string[] = [];
  for (const tab of Object.values(s.tabs)) {
    if (!hibernatable(s, tab.id, now)) continue;
    const outcome = await webviews.get(tab.id)?.discard({ unload: true }).catch(() => "refused" as const);
    if (outcome === "discarded") hibernated.push(tab.id);
  }
  return hibernated;
}

let started = false;

export function startTabHibernation() {
  if (started) return;
  started = true;
  everySlowly({ every: SWEEP_MS, run: () => void sweepHibernation() });
}
