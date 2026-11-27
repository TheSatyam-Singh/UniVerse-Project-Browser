import { hostOf } from "@universe/core";

export type ReadingListItem = {
  url: string;
  title: string;
  site: string;
  favicon: string | null;
  addedAt: number;
};

const DOC_VERSION = 1;
export const MAX_READING_LIST = 500;

export function readingListSiteOf(url: string): string {
  return hostOf(url);
}

export function canSaveToReadingList(url: string | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

export function readingListItemOf(url: string, title: string, favicon: string | null, addedAt = Date.now()): ReadingListItem {
  return { url, title, site: readingListSiteOf(url), favicon, addedAt };
}

export function withReadingListItem(items: ReadingListItem[], item: ReadingListItem): ReadingListItem[] {
  return [item, ...items.filter((x) => x.url !== item.url)].slice(0, MAX_READING_LIST);
}

export function withoutReadingListItem(items: ReadingListItem[], url: string): ReadingListItem[] {
  return items.filter((x) => x.url !== url);
}

export function parseReadingList(text: string | null | undefined): ReadingListItem[] {
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return [];
    const items = (parsed as { items?: unknown }).items;
    if (!Array.isArray(items)) return [];
    const out: ReadingListItem[] = [];
    for (const value of items) {
      if (!value || typeof value !== "object") continue;
      const entry = value as { url?: unknown; title?: unknown; site?: unknown; favicon?: unknown; addedAt?: unknown };
      if (typeof entry.url !== "string" || typeof entry.title !== "string") continue;
      out.push({
        url: entry.url,
        title: entry.title,
        site: typeof entry.site === "string" ? entry.site : readingListSiteOf(entry.url),
        favicon: typeof entry.favicon === "string" ? entry.favicon : null,
        addedAt: typeof entry.addedAt === "number" ? entry.addedAt : 0,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeReadingList(items: ReadingListItem[]): string {
  return JSON.stringify({ version: DOC_VERSION, items });
}
