import type { StateCreator } from "zustand";
import type { BrowserState } from "../browser/store";
import { activeTabId, inPinnedContainer } from "../browser/model";
import { splitOf, splitTabIdsOf } from "../splits/splits";
import { archiveAfterMs } from "../settings/settings";
import {
  addArchiveEntry,
  archiveEntryFor,
  archiveRestoreUrls,
  hostOfUrl,
  idleArchiveRoots,
  removeArchivedContaining,
  type ArchiveEntry,
  type ArchiveItem,
  type ArchiveReason,
  type ArchiveTabInput,
} from "./archive";

export type ArchiveSlice = {
  archiveEntries: ArchiveEntry[];
  archiveLastActive: Record<string, number>;

  archiveClosedTabs(items: ArchiveItem[], spaceId: string, reason?: ArchiveReason, now?: number): void;
  removeFromArchive(id: string): void;
  restoreArchived(id: string, windowId: string): string[];
  noteTabActive(id: string, at?: number): void;
  archiveIdleTabs(now?: number): string[];
};

export const archiveItemsOfTabs = (s: Pick<BrowserState, "tabs" | "groups">, ids: string[]): ArchiveItem[] =>
  ids
    .map((id) => s.tabs[id])
    .filter((t): t is NonNullable<typeof t> => !!t && !!t.url)
    .map((t) => ({ id: t.id, title: t.title || t.url, url: t.url, host: hostOfUrl(t.url), profileId: t.profileId }));

export const createArchiveSlice: StateCreator<BrowserState, [], [], ArchiveSlice> = (set, get) => ({
  archiveEntries: [],
  archiveLastActive: {},

  archiveClosedTabs(items, spaceId, reason = "closed", now = Date.now()) {
    const entry = archiveEntryFor(items, spaceId, reason, now);
    if (!entry) return;
    set((s) => ({ archiveEntries: addArchiveEntry(s.archiveEntries, entry) }));
  },

  removeFromArchive(id) {
    set((s) => {
      const { entries, removed } = removeArchivedContaining(s.archiveEntries, new Set([id]));
      return removed ? { archiveEntries: entries } : {};
    });
  },

  restoreArchived(id, windowId) {
    const entry = get().archiveEntries.find((e) => e.id === id);
    if (!entry || !get().windows[windowId]) return [];
    const urls = archiveRestoreUrls(entry);
    const opened: string[] = [];
    urls.forEach((url, index) => {
      const openedId = get().newTab(windowId, { url, background: index > 0 });
      if (openedId) opened.push(openedId);
    });
    if (opened.length) {
      get().removeFromArchive(id);
      const first = get().tabs[opened[0]!];
      if (first) get().activate(opened[0]!);
    }
    return opened;
  },

  noteTabActive(id, at = Date.now()) {
    set((s) => ({ archiveLastActive: { ...s.archiveLastActive, [id]: at } }));
  },

  archiveIdleTabs(now = Date.now()) {
    const s = get();
    const intervalMs = archiveAfterMs(s.settings);
    if (intervalMs === null) return [];
    const protectedIds = new Set<string>();
    for (const w of Object.values(s.windows)) {
      const active = activeTabId(s, w.id);
      if (active) protectedIds.add(active);
      for (const pane of splitTabIdsOf(splitOf(s, w.id)) ?? []) protectedIds.add(pane);
    }
    for (const [id, live] of Object.entries(s.live)) if (live.playingAudio) protectedIds.add(id);
    const grouped = new Set(Object.values(s.groups).flatMap((g) => g.tabIds));
    const inputs: ArchiveTabInput[] = Object.values(s.tabs)
      .filter((t) => !!t.url && !inPinnedContainer(s, t.id) && !grouped.has(t.id))
      .map((t) => ({ id: t.id, profileId: t.profileId, lastActive: s.archiveLastActive[t.id] ?? null }));
    const { roots, lastActive } = idleArchiveRoots(inputs, s.archiveLastActive, intervalMs, protectedIds, now);
    if (!roots.length) {
      if (lastActive !== s.archiveLastActive) set({ archiveLastActive: lastActive });
      return [];
    }
    const archived: string[] = [];
    set((state) => {
      let entries = state.archiveEntries;
      for (const root of roots) {
        const entry = archiveEntryFor(archiveItemsOfTabs(state, [root]), state.tabs[root]!.profileId, "auto", now);
        if (entry) entries = addArchiveEntry(entries, entry);
      }
      return { archiveEntries: entries, archiveLastActive: lastActive };
    });
    for (const root of roots) {
      if (get().tabs[root]) {
        get().closeTab(root, { skipArchive: true });
        archived.push(root);
      }
    }
    return archived;
  },
});
