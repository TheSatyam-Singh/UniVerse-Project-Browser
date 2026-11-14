import { isFields, isString } from "../../lib/decode";

export const ARCHIVE_RETENTION_DAYS = 30;
export const ARCHIVE_MAX_ENTRIES = 1000;
export const ARCHIVE_RETENTION_MS = ARCHIVE_RETENTION_DAYS * 86_400_000;

export type ArchiveReason = "closed" | "auto";

export type ArchiveItem = {
  id: string;
  title: string;
  url: string;
  host: string | null;
  profileId: string;
  parentId?: string | null;
  isFolder?: boolean;
};

export type ArchiveEntry = {
  id: string;
  items: ArchiveItem[];
  spaceId: string;
  title: string;
  url: string | null;
  host: string | null;
  archivedAt: number;
  reason: ArchiveReason;
};

export const hostOfUrl = (url: string): string | null => {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
};

export function archiveEntryFor(items: ArchiveItem[], spaceId: string, reason: ArchiveReason, now = Date.now()): ArchiveEntry | null {
  const root = items[0];
  if (!root) return null;
  return {
    id: root.id,
    items,
    spaceId,
    title: root.title,
    url: root.isFolder ? null : root.url,
    host: root.isFolder ? null : hostOfUrl(root.url),
    archivedAt: now,
    reason,
  };
}

export function trimArchive(entries: ArchiveEntry[], now = Date.now()): ArchiveEntry[] {
  const cutoff = now - ARCHIVE_RETENTION_MS;
  const kept = entries.filter((e) => e.archivedAt >= cutoff);
  return kept.length > ARCHIVE_MAX_ENTRIES ? kept.slice(kept.length - ARCHIVE_MAX_ENTRIES) : kept;
}

export function addArchiveEntry(entries: ArchiveEntry[], entry: ArchiveEntry): ArchiveEntry[] {
  return trimArchive([...entries.filter((e) => e.id !== entry.id), entry], entry.archivedAt);
}

export function mergeArchiveEntries(entries: ArchiveEntry[], added: ArchiveEntry[], now = Date.now()): ArchiveEntry[] {
  return trimArchive([...entries, ...added].sort((a, b) => a.archivedAt - b.archivedAt), now);
}

export function removeArchivedContaining(entries: ArchiveEntry[], ids: Set<string>): { entries: ArchiveEntry[]; removed: boolean } {
  const next = entries.filter((e) => !e.items.some((item) => ids.has(item.id)));
  return { entries: next, removed: next.length !== entries.length };
}

export function parseArchiveEntries(raw: unknown): ArchiveEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: ArchiveEntry[] = [];
  for (const value of raw) {
    if (!isFields(value) || !isString(value.id) || !isString(value.spaceId) || !isString(value.title) || typeof value.archivedAt !== "number") continue;
    if (!Array.isArray(value.items)) continue;
    const items: ArchiveItem[] = [];
    for (const rawItem of value.items) {
      if (!isFields(rawItem) || !isString(rawItem.id) || !isString(rawItem.title) || !isString(rawItem.url) || !isString(rawItem.profileId)) continue;
      items.push({
        id: rawItem.id,
        title: rawItem.title,
        url: rawItem.url,
        host: isString(rawItem.host) ? rawItem.host : hostOfUrl(rawItem.url),
        profileId: rawItem.profileId,
        ...(isString(rawItem.parentId) || rawItem.parentId === null ? { parentId: rawItem.parentId } : {}),
        ...(typeof rawItem.isFolder === "boolean" ? { isFolder: rawItem.isFolder } : {}),
      });
    }
    if (!items.length) continue;
    entries.push({
      id: value.id,
      items,
      spaceId: value.spaceId,
      title: value.title,
      url: isString(value.url) ? value.url : null,
      host: isString(value.host) ? value.host : null,
      archivedAt: value.archivedAt,
      reason: value.reason === "auto" ? "auto" : "closed",
    });
  }
  return trimArchive(entries);
}

export type ArchiveTabInput = {
  id: string;
  profileId: string;
  parentId?: string | null;
  isFolder?: boolean;
  isAgentSpace?: boolean;
  lastActive?: number | null;
};

export function idleArchiveRoots(
  tabs: ArchiveTabInput[],
  lastActive: Record<string, number>,
  intervalMs: number,
  protectedIds: Set<string>,
  now = Date.now(),
): { roots: string[]; lastActive: Record<string, number> } {
  const stamps = { ...lastActive };
  const byParent = new Map<string, ArchiveTabInput[]>();
  for (const tab of tabs) {
    const key = tab.parentId ?? "";
    const list = byParent.get(key) ?? [];
    list.push(tab);
    byParent.set(key, list);
  }
  const roots: string[] = [];
  for (const root of tabs.filter((t) => !t.parentId && !t.isFolder && !t.isAgentSpace)) {
    const ids: string[] = [];
    const stack = [root.id];
    while (stack.length) {
      const next = stack.pop()!;
      ids.push(next);
      for (const child of byParent.get(next) ?? []) stack.push(child.id);
    }
    for (const id of ids) stamps[id] ??= now;
    const newest = Math.max(...ids.map((id) => stamps[id]!));
    if (newest <= now - intervalMs && ids.every((id) => !protectedIds.has(id))) roots.push(root.id);
  }
  return { roots, lastActive: stamps };
}

export const archiveRestoreUrls = (entry: ArchiveEntry): string[] =>
  entry.items.filter((item) => !item.isFolder && !!item.url).map((item) => item.url);
