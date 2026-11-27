import type { BrowserState } from "../browser/store";
import type { ClosedTab } from "../browser/types";

export const MAX_RECENTLY_CLOSED = 10;

export function recentlyClosedTabs(s: Pick<BrowserState, "closedTabs">, profileId: string): ClosedTab[] {
  return s.closedTabs
    .filter((c) => c.tab.profileId === profileId && !c.tab.profileId.startsWith("incognito:"))
    .sort((a, b) => b.closedAt - a.closedAt)
    .slice(0, MAX_RECENTLY_CLOSED);
}
