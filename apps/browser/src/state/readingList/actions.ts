import { isIncognitoProfile, tabTitle } from "../browser/model";
import { useBrowser } from "../browser/store";
import { capture } from "../telemetry/client";
import { canSaveToReadingList, readingListItemOf } from "./readingListDocument";
import { addReadingList, removeReadingList } from "./readingList";

export function addTabToReadingList(windowId: string, tabId: string): boolean {
  const s = useBrowser.getState();
  const tab = s.tabs[tabId];
  if (!s.windows[windowId] || !tab || isIncognitoProfile(tab.profileId) || !canSaveToReadingList(tab.url)) return false;
  addReadingList(readingListItemOf(tab.url, tabTitle(tab), tab.favicon));
  capture("reading_list_added", {});
  return true;
}

export function openReadingListItem(windowId: string, url: string) {
  const s = useBrowser.getState();
  if (!s.windows[windowId]) return;
  s.newTab(windowId, { url });
  removeReadingList(url);
  capture("reading_list_opened_item", {});
}
