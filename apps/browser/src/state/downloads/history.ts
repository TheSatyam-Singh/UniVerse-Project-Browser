import { readDocument, writeDocument } from "../../platform/documents";
import { openUrl } from "../bookmarks/actions";
import type { Download } from "../../platform/downloads";

export const DOWNLOADS_HISTORY_DOC = "downloads-history.json";
export const MAX_DOWNLOAD_HISTORY = 100;
const HISTORY_VERSION = 1;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isDownloadState = (v: unknown): v is Download["state"] =>
  v === "downloading" || v === "finished" || v === "failed" || v === "cancelled";

function parseDownload(raw: unknown): Download | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (typeof raw.url !== "string" || !raw.url) return null;
  if (typeof raw.filename !== "string") return null;
  if (!isDownloadState(raw.state)) return null;
  if (typeof raw.received !== "number" || typeof raw.total !== "number" || typeof raw.speed !== "number") return null;
  return {
    id: raw.id,
    url: raw.url,
    filename: raw.filename,
    path: typeof raw.path === "string" ? raw.path : "",
    state: raw.state,
    paused: raw.paused === true,
    dangerous: raw.dangerous === true ? true : undefined,
    received: raw.received,
    total: raw.total,
    speed: raw.speed,
    mimeType: typeof raw.mimeType === "string" ? raw.mimeType : "",
    profile: typeof raw.profile === "string" ? raw.profile : undefined,
    offTheRecord: raw.offTheRecord === true ? true : undefined,
    staging: typeof raw.staging === "string" ? raw.staging : null,
  };
}

export function keptDownloadHistory(downloads: readonly Download[]): Download[] {
  return downloads.filter((d) => d.state !== "downloading" && !d.offTheRecord).slice(0, MAX_DOWNLOAD_HISTORY);
}

export function downloadHistoryJson(downloads: readonly Download[]): string {
  return JSON.stringify({ version: HISTORY_VERSION, downloads: keptDownloadHistory(downloads) });
}

export function parseDownloadHistory(text: string | null): Download[] {
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    const raw = isRecord(parsed) && Array.isArray(parsed.downloads) ? parsed.downloads : Array.isArray(parsed) ? parsed : null;
    if (!raw) return [];
    const kept: Download[] = [];
    for (const entry of raw) {
      const d = parseDownload(entry);
      if (d && d.state !== "downloading" && !d.offTheRecord) kept.push(d);
      if (kept.length >= MAX_DOWNLOAD_HISTORY) break;
    }
    return kept;
  } catch {
    return [];
  }
}

export function loadDownloadHistory(): Download[] {
  try {
    return parseDownloadHistory(readDocument(DOWNLOADS_HISTORY_DOC));
  } catch {
    return [];
  }
}

export function writeDownloadHistory(json: string): boolean {
  try {
    writeDocument(DOWNLOADS_HISTORY_DOC, json);
    return true;
  } catch (error) {
    console.warn("[downloads] couldn't save download history", error);
    return false;
  }
}

export const canRetryDownload = (d: Pick<Download, "state">) => d.state === "failed";

export function retryDownload(d: Download, windowId: string) {
  openUrl(d.url, windowId, "foreground");
}
