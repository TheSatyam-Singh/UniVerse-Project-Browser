import type { PageBridge } from "@universe/ai";
import { webviews } from "../../platform/webviews";
import { activeTabId, isIncognitoProfile, tabTitle } from "../browser/model";
import { useBrowser } from "../browser/store";
import { focusedWindowId } from "../browser/current";
import { openUrls } from "../browser/actions";
import { focusedWindowOf } from "../windows/ui";

export const PAGE_SCRIPT_NOT_WIRED =
  "No page view is mounted for the active tab, so page scripts cannot run yet.";

let pageEvaluator: ((tabId: string, code: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

export function setPageEvaluator(evaluator: ((tabId: string, code: string, args?: Record<string, unknown>) => Promise<unknown>) | null): void {
  pageEvaluator = evaluator;
}

async function defaultEvaluate(tabId: string, code: string, args?: Record<string, unknown>): Promise<unknown> {
  const handle = webviews.get(tabId);
  if (!handle) throw new Error(PAGE_SCRIPT_NOT_WIRED);
  const declarations = args ? Object.entries(args).map(([key, value]) => `const ${key} = ${JSON.stringify(value)};`).join("\n") : "";
  return handle.evaluate(declarations ? `${declarations}\n${code}` : code);
}

export function pageEvaluationWired(): boolean {
  if (pageEvaluator) return true;
  const s = useBrowser.getState();
  const windowId = focusedWindowOf(s);
  if (!windowId) return false;
  const active = activeTabId(s, windowId);
  return !!active && webviews.has(active);
}

function focusedWindow(): string | null {
  return focusedWindowOf(useBrowser.getState());
}

export function buildPageBridge(): PageBridge {
  return {
    listTabs: () => {
      const s = useBrowser.getState();
      const windowId = focusedWindow();
      if (!windowId) return [];
      const w = s.windows[windowId];
      if (!w) return [];
      return w.tabIds
        .map((id, index) => {
          const tab = s.tabs[id];
          if (!tab) return null;
          return { id, index, title: tabTitle(tab), url: tab.url, isActive: activeTabId(s, windowId) === id };
        })
        .filter((t): t is { id: string; index: number; title: string; url: string; isActive: boolean } => t !== null);
    },
    activeTabId: () => {
      const s = useBrowser.getState();
      const windowId = focusedWindow();
      return windowId ? (activeTabId(s, windowId) ?? null) : null;
    },
    activateTab: (tabId) => {
      useBrowser.getState().activate(tabId);
    },
    createTab: (url) => {
      const windowId = focusedWindow();
      if (!windowId) return null;
      if (url) {
        openUrls([url], windowId);
        return null;
      }
      return useBrowser.getState().newTab(windowId);
    },
    navigateTab: (tabId, url) => {
      useBrowser.getState().navigate(tabId, url, { userInitiated: true });
    },
    evaluateJs: async (tabId, code) => {
      if (pageEvaluator) return pageEvaluator(tabId, code);
      return defaultEvaluate(tabId, code);
    },
    evaluateJsWithArg: async (tabId, code, args) => {
      if (pageEvaluator) return pageEvaluator(tabId, code, args);
      return defaultEvaluate(tabId, code, args);
    },
    isPrivateWindow: () => {
      const s = useBrowser.getState();
      const windowId = focusedWindowId();
      if (!windowId) return false;
      const w = s.windows[windowId];
      if (!w) return false;
      return w.kind === "private" || isIncognitoProfile(w.profileId);
    },
  };
}
