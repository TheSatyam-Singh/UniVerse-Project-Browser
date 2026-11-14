import { pageTextIndex } from "./pageTextIndex";
import { useBrowser } from "../browser/store";
import { isIncognitoProfile, tabTitle } from "../browser/model";
import { webviews } from "../../platform/webviews";

const PAGE_TEXT_SCRIPT = "(document.body ? document.body.innerText : '')";

const captured = new Map<string, string>();
const inFlight = new Set<string>();

export function capturePageTextForHistory(tabId: string): Promise<void> {
  const s = useBrowser.getState();
  if (!s.settings.searchPageTextInHistory) return Promise.resolve();
  const tab = s.tabs[tabId];
  if (!tab) {
    captured.delete(tabId);
    return Promise.resolve();
  }
  if (!tab.url || !/^https?:\/\//.test(tab.url) || isIncognitoProfile(tab.profileId)) return Promise.resolve();
  if (captured.get(tabId) === tab.url || inFlight.has(tabId)) return Promise.resolve();
  const handle = webviews.get(tabId);
  if (!handle) return Promise.resolve();
  const url = tab.url;
  inFlight.add(tabId);
  return handle
    .evaluate(PAGE_TEXT_SCRIPT)
    .then((text) => {
      if (typeof text !== "string" || !text.trim()) return;
      const current = useBrowser.getState().tabs[tabId];
      if (!current || current.url !== url) return;
      captured.set(tabId, url);
      pageTextIndex.record(url, tabTitle(current), text);
    })
    .catch(() => {})
    .finally(() => {
      inFlight.delete(tabId);
    });
}
