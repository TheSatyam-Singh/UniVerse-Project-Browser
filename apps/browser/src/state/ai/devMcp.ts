import { createDevMcpControl } from "../../platform/devMcp";
import type { DevMcpBridge } from "@universe/ai";
import { buildPageBridge } from "./aiBridge";
import { useBrowser } from "../browser/store";
import { openUrls } from "../browser/actions";
import { focusedWindowOf } from "../windows/ui";

const READ_PAGE_DEFAULT_MAX_LENGTH = 8000;
const PAGE_TEXT_SCRIPT = "(document.body ? document.body.innerText : '')";

function activeTabId(): string {
  const bridge = buildPageBridge();
  const id = bridge.activeTabId();
  if (!id) throw new Error("No active tab");
  return id;
}

export function buildDevMcpBridge(): DevMcpBridge {
  const bridge = buildPageBridge();
  return {
    listTabs: () => bridge.listTabs().map(({ index, title, url, isActive }) => ({ index, title, url, isActive })),
    openUrl: (url) => {
      openUrls([url], focusedWindowOf(useBrowser.getState()));
      return url;
    },
    navigate: (url) => {
      bridge.navigateTab(activeTabId(), url);
      return url;
    },
    readPage: async (maxLength) => {
      const text = await bridge.evaluateJs(activeTabId(), PAGE_TEXT_SCRIPT);
      return typeof text === "string" ? text.slice(0, maxLength ?? READ_PAGE_DEFAULT_MAX_LENGTH) : "";
    },
    evaluate: (code) => bridge.evaluateJs(activeTabId(), code),
    downloadUrl: () =>
      Promise.reject(new Error("Download to a file is not wired: the app has no file-write bridge for ~/Downloads/UniVerse MCP yet")),
  };
}

let started = false;

export function startDevMcp() {
  if (started) return;
  started = true;
  const control = createDevMcpControl(buildDevMcpBridge());
  const sync = () => control.applyEnabledSetting(useBrowser.getState().settings.browserControlServerEnabled);
  sync();
  useBrowser.subscribe((s, prev) => {
    if (s.settings.browserControlServerEnabled !== prev.settings.browserControlServerEnabled) sync();
  });
}
