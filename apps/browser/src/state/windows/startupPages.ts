import { useBrowser } from "../browser/store";
import type { Settings } from "../settings/settings";
import { noteStartupPagesOpened } from "../telemetry/startupPages";

const MAX_STARTUP_PAGES = 20;

export function normalizeStartupPage(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.href;
}

export function normalizeStartupPages(pages: unknown): string[] {
  if (!Array.isArray(pages)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const page of pages) {
    if (typeof page !== "string") continue;
    const url = normalizeStartupPage(page);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_STARTUP_PAGES) break;
  }
  return out;
}

export function startupPageUrls(settings: Pick<Settings, "startupMode" | "startupPages">): string[] {
  return settings.startupMode === "customPages" ? normalizeStartupPages(settings.startupPages) : [];
}

export function openStartupWindow(): string {
  const s = useBrowser.getState();
  const urls = startupPageUrls(s.settings);
  if (!urls.length) return s.createWindow();
  const id = s.createWindow({ url: urls[0] });
  for (const url of urls.slice(1)) useBrowser.getState().newTab(id, { url, background: true });
  noteStartupPagesOpened(urls.length);
  return id;
}
