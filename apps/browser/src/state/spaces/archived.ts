import type { StateCreator } from "zustand";
import type { BrowserState } from "../browser/store";
import type { ClosedGroupInfo, ClosedTab, TabSnapshot } from "../browser/types";
import { closeQuietly, closedEntries } from "../pins/closedTabs";
import { cleanUpCandidates } from "../pins/tabCleanup";
import { isFields, isString } from "../../lib/decode";
import { parseSaved } from "../../lib/savedDocument";
import { isIncognitoProfile } from "../browser/model";
import type { GroupColor } from "../browser/types";
import { GROUP_COLOR_ORDER } from "../groups/tokens";
import { spaceVisibleTabIds, withTabInSpace } from "./spaces";

export const ARCHIVED_DOCUMENT = "archived.json";
export const ARCHIVED_VERSION = 1;
export const MAX_ARCHIVED_TABS = 100;

export type ArchivedTab = ClosedTab & { archivedAt: number };

export type ArchivedSlice = {
  archivedTabs: ArchivedTab[];

  archiveTabs(windowId: string, tabIds: string[]): number;
  restoreArchivedTab(windowId: string, id: string): void;
  restoreArchivedTabs(windowId: string, ids: string[]): void;
  deleteArchivedTab(id: string): void;
  clearArchivedTabs(): void;
  archiveInactiveTabs(windowId: string, inactiveForMs: number): number;
};

export const savedArchivedTabs = (s: Pick<BrowserState, "archivedTabs">): ArchivedTab[] =>
  s.archivedTabs.filter((a) => !isIncognitoProfile(a.tab.profileId));

export const createArchivedSlice: StateCreator<BrowserState, [], [], ArchivedSlice> = (set, get) => ({
  archivedTabs: [],

  archiveTabs(windowId, tabIds) {
    const s = get();
    if (!s.windows[windowId]) return 0;
    const entries = closedEntries(s, tabIds).map((e) => ({ ...e, archivedAt: Date.now() }));
    if (!entries.length) return 0;
    let next = closeQuietly(s, tabIds);
    for (const id of tabIds) next = withTabInSpace(next, id, null);
    set({ ...next, archivedTabs: [...entries, ...s.archivedTabs].slice(0, MAX_ARCHIVED_TABS) });
    return entries.length;
  },

  restoreArchivedTab(windowId, id) {
    const s = get();
    const entry = s.archivedTabs.find((a) => a.id === id);
    if (!entry) return;
    set({ archivedTabs: s.archivedTabs.filter((a) => a.id !== id), closedTabs: [entry, ...s.closedTabs] });
    get().restoreClosed(entry.id, windowId);
  },

  restoreArchivedTabs(windowId, ids) {
    for (const id of ids) get().restoreArchivedTab(windowId, id);
  },

  deleteArchivedTab(id) {
    const s = get();
    if (!s.archivedTabs.some((a) => a.id === id)) return;
    set({ archivedTabs: s.archivedTabs.filter((a) => a.id !== id) });
  },

  clearArchivedTabs() {
    if (!get().archivedTabs.length) return;
    set({ archivedTabs: [] });
  },

  archiveInactiveTabs(windowId, inactiveForMs) {
    const s = get();
    if (!s.windows[windowId]) return 0;
    const visible = spaceVisibleTabIds(s, windowId);
    const candidates = cleanUpCandidates(s, windowId, inactiveForMs).filter((id) => !visible || visible.has(id));
    if (!candidates.length) return 0;
    return get().archiveTabs(windowId, candidates);
  },
});

export const snapshotFrom = (o: unknown): TabSnapshot | null => {
  if (!isFields(o) || !isString(o.url) || !isString(o.profileId)) return null;
  return {
    url: o.url,
    title: isString(o.title) ? o.title : "",
    favicon: isString(o.favicon) ? o.favicon : null,
    pin: null,
    muted: o.muted === true,
    zoom: typeof o.zoom === "number" ? o.zoom : 1,
    customTitle: isString(o.customTitle) ? o.customTitle : null,
    customIcon: isString(o.customIcon) ? o.customIcon : null,
    profileId: o.profileId,
    ...(isString(o.pinnedUrl) ? { pinnedUrl: o.pinnedUrl } : {}),
    ...(typeof o.lastActiveAt === "number" ? { lastActiveAt: o.lastActiveAt } : {}),
  };
};

const groupInfoFrom = (o: unknown): ClosedGroupInfo | null => {
  if (!isFields(o) || !isString(o.id) || !isString(o.name)) return null;
  const color =
    isString(o.color) && ((GROUP_COLOR_ORDER as readonly string[]).includes(o.color) || o.color === "none") ? (o.color as GroupColor) : null;
  return {
    id: o.id,
    name: o.name,
    icon: isString(o.icon) ? o.icon : null,
    color,
    ...(o.pinned === true ? { pinned: true as const } : {}),
  };
};

const archivedFrom = (o: unknown): ArchivedTab | null => {
  if (!isFields(o) || !isString(o.id) || !isString(o.windowId) || typeof o.index !== "number" || typeof o.archivedAt !== "number") return null;
  const tab = snapshotFrom(o.tab);
  if (!tab) return null;
  const group = o.group === null || o.group === undefined ? null : groupInfoFrom(o.group);
  if (o.group !== null && o.group !== undefined && !group) return null;
  const parents = Array.isArray(o.parents) ? o.parents.map((p) => groupInfoFrom(p)).filter((p): p is ClosedGroupInfo => !!p) : [];
  return {
    kind: "tab",
    id: o.id,
    tab,
    tabId: isString(o.tabId) ? o.tabId : undefined,
    restoreFrom: isString(o.restoreFrom) ? o.restoreFrom : undefined,
    windowId: o.windowId,
    index: o.index,
    group,
    ...(parents.length ? { parents } : {}),
    closedAt: typeof o.closedAt === "number" ? o.closedAt : o.archivedAt,
    archivedAt: o.archivedAt,
  };
};

export function parseArchivedDoc(json: string | null | undefined): Pick<BrowserState, "archivedTabs"> | null {
  const raw = parseSaved(json, ARCHIVED_VERSION);
  if (!raw) return null;
  const archivedTabs = (Array.isArray(raw.archivedTabs) ? raw.archivedTabs : [])
    .map((o) => archivedFrom(o))
    .filter((x): x is ArchivedTab => !!x)
    .slice(0, MAX_ARCHIVED_TABS);
  return { archivedTabs };
}
