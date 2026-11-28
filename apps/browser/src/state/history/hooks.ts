import { useShallow } from "zustand/react/shallow";
import { useBrowser } from "../browser/store";
import { historyOf, NO_HISTORY } from "./history";
import { recentlyClosedTabs } from "./recentlyClosed";

export const useProfileHistory = (profileId: string | null) => useBrowser((s) => (profileId === null ? NO_HISTORY : historyOf(s, profileId)));

export const useRecentlyClosedTabs = (profileId: string) => useBrowser(useShallow((s) => recentlyClosedTabs(s, profileId)));

export const useWindowHistory = (windowId: string | null) =>
  useBrowser((s) => {
    const w = windowId ? s.windows[windowId] : undefined;
    return w ? historyOf(s, w.profileId) : undefined;
  });
