import { revealFile, saveDataFile } from "../../platform/files";
import { webviews } from "../../platform/webviews";
import { showToast } from "../app/toasts";
import { activeTabId } from "../browser/model";
import { useBrowser } from "../browser/store";
import { tabEngine } from "../engines/engines";
import { noteScreenshotTaken } from "../telemetry/screenshots";

const two = (n: number) => String(n).padStart(2, "0");

export function screenshotFileName(url: string, fullPage: boolean, now = new Date()): string {
  let host = "page";
  try {
    host = new URL(url).host.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "page";
  } catch {
    host = "page";
  }
  const date = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  const time = `${two(now.getHours())}.${two(now.getMinutes())}.${two(now.getSeconds())}`;
  return `${fullPage ? "Full Page Screenshot" : "Screenshot"} ${host} ${date} at ${time}.png`;
}

const fileName = (path: string) => path.split("/").pop() ?? path;

export async function takeScreenshot(windowId: string, fullPage: boolean, tabId?: string): Promise<void> {
  const s = useBrowser.getState();
  const id = tabId ?? activeTabId(s, windowId);
  const tab = id ? s.tabs[id] : undefined;
  if (!tab?.url) return showToast(windowId, "Nothing to capture yet");
  if (s.windows[windowId]?.kind === "private") return showToast(windowId, "Screenshots aren't saved from private windows");
  const view = webviews.get(tab.id);
  if (!view) return showToast(windowId, "Couldn't capture the screenshot");
  let shot: { data: string } | null = null;
  try {
    shot = await view.captureScreenshot(fullPage);
  } catch {
    shot = null;
  }
  if (!shot) {
    if (fullPage && tabEngine(s, tab.id) === "webkit") return showToast(windowId, "Full-page screenshots need the Chromium engine");
    return showToast(windowId, "Couldn't capture the screenshot");
  }
  const path = await saveDataFile(screenshotFileName(tab.url, fullPage), shot.data);
  if (!path) return showToast(windowId, "Couldn't save the screenshot");
  noteScreenshotTaken(fullPage);
  showToast(windowId, "Screenshot saved", fileName(path), { icon: "camera", action: { title: "Show in Finder", run: () => void revealFile(path) } });
}
