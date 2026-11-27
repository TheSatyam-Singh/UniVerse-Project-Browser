import { useBrowser, type BrowserState } from "../browser/store";
import { downloadSession } from "./downloadsSlice";
import { downloadHistoryJson, loadDownloadHistory, writeDownloadHistory } from "./history";

let started = false;
let restoring = false;
let lastSaved = "";

function persistable(s: BrowserState) {
  return s.downloads.filter((d) => d.state !== "downloading" && downloadSession(s, d) === null);
}

export function startDownloadHistory() {
  if (started) return;
  started = true;
  const saved = loadDownloadHistory();
  lastSaved = downloadHistoryJson(saved);
  if (saved.length) {
    restoring = true;
    useBrowser.getState().restoreDownloads(saved);
    restoring = false;
  }
  useBrowser.subscribe((s, prev) => {
    if (restoring || s.downloads === prev.downloads) return;
    const json = downloadHistoryJson(persistable(s));
    if (json === lastSaved) return;
    lastSaved = json;
    writeDownloadHistory(json);
  });
}
