import type { StateCreator } from "zustand";
import { activeTabId, inPinnedContainer, newId } from "../browser/model";
import type { BrowserState } from "../browser/store";
import type { Tab } from "../browser/types";
import { isFields, isString, isStringList } from "../../lib/decode";
import { parseSaved, type SavedObject } from "../../lib/savedDocument";
import { GROUP_COLOR_ORDER, type GroupTint } from "../groups/tokens";
import { isRegularWindow } from "../windows/small";

export const SPACES_DOCUMENT = "spaces.json";
export const SPACES_VERSION = 1;
export const MAX_SPACES_PER_WINDOW = 12;

export type Space = {
  id: string;
  windowId: string;
  name: string;
  color: GroupTint;
  tabIds: string[];
  createdAt: number;
};

export type SpacesSlice = {
  spaces: Record<string, Space>;
  activeSpaceId: Record<string, string | null>;

  createSpace(windowId: string, name?: string): string;
  renameSpace(id: string, name: string): void;
  setSpaceColor(id: string, color: GroupTint): void;
  deleteSpace(id: string): void;
  switchSpace(windowId: string, spaceId: string | null): void;
  moveTabsToSpace(windowId: string, tabIds: string[], spaceId: string | null): void;
  newTabInSpace(windowId: string, spaceId: string): string;
};

export const spacesOf = (s: Pick<BrowserState, "spaces">, windowId: string): Space[] =>
  Object.values(s.spaces)
    .filter((space) => space.windowId === windowId)
    .sort((a, b) => a.createdAt - b.createdAt);

export const activeSpaceOf = (s: Pick<BrowserState, "spaces" | "activeSpaceId">, windowId: string): Space | null =>
  s.spaces[s.activeSpaceId[windowId] ?? ""] ?? null;

export const spaceOfTab = (s: Pick<BrowserState, "spaces">, tabId: string): Space | null =>
  Object.values(s.spaces).find((space) => space.tabIds.includes(tabId)) ?? null;

export const spaceVisibleTabIds = (
  s: Pick<BrowserState, "spaces" | "activeSpaceId" | "tabs" | "windows">,
  windowId: string,
  profileId?: string,
): Set<string> | null => {
  const space = activeSpaceOf(s, windowId);
  if (!space) return null;
  const w = s.windows[windowId];
  if (!w) return null;
  if (profileId && profileId !== w.profileId) return null;
  const profile = profileId ?? w.profileId;
  return new Set(space.tabIds.filter((id) => s.tabs[id]?.windowId === windowId && s.tabs[id]?.profileId === profile));
};

export const withTabInSpace = (s: BrowserState, tabId: string, spaceId: string | null): BrowserState => {
  const spaces = { ...s.spaces };
  for (const space of Object.values(spaces)) {
    if (!space.tabIds.includes(tabId)) continue;
    spaces[space.id] = { ...space, tabIds: space.tabIds.filter((id) => id !== tabId) };
  }
  const target = spaceId ? spaces[spaceId] : undefined;
  if (target) spaces[target.id] = { ...target, tabIds: [...target.tabIds, tabId] };
  return { ...s, spaces };
};

export const createSpacesSlice: StateCreator<BrowserState, [], [], SpacesSlice> = (set, get) => ({
  spaces: {},
  activeSpaceId: {},

  createSpace(windowId, name) {
    const s = get();
    if (!s.windows[windowId]) return "";
    const mine = spacesOf(s, windowId);
    if (mine.length >= MAX_SPACES_PER_WINDOW) return "";
    const id = newId("space");
    const space: Space = {
      id,
      windowId,
      name: (name ?? "").trim() || `Space ${mine.length + 1}`,
      color: GROUP_COLOR_ORDER[mine.length % GROUP_COLOR_ORDER.length]!,
      tabIds: [],
      createdAt: Date.now(),
    };
    set({ spaces: { ...s.spaces, [id]: space }, activeSpaceId: { ...s.activeSpaceId, [windowId]: id } });
    get().switchSpace(windowId, id);
    return id;
  },

  renameSpace(id, name) {
    const s = get();
    const space = s.spaces[id];
    const trimmed = name.trim();
    if (!space || !trimmed || space.name === trimmed) return;
    set({ spaces: { ...s.spaces, [id]: { ...space, name: trimmed } } });
  },

  setSpaceColor(id, color) {
    const s = get();
    const space = s.spaces[id];
    if (!space || space.color === color) return;
    set({ spaces: { ...s.spaces, [id]: { ...space, color } } });
  },

  deleteSpace(id) {
    const s = get();
    const space = s.spaces[id];
    if (!space) return;
    const { [id]: _, ...spaces } = s.spaces;
    const activeSpaceId = { ...s.activeSpaceId };
    if (activeSpaceId[space.windowId] === id) delete activeSpaceId[space.windowId];
    set({ spaces, activeSpaceId });
  },

  switchSpace(windowId, spaceId) {
    const s = get();
    const w = s.windows[windowId];
    if (!w) return;
    if (spaceId && s.spaces[spaceId]?.windowId !== windowId) return;
    set({ activeSpaceId: { ...s.activeSpaceId, [windowId]: spaceId } });
    const after = get();
    const active = activeTabId(after, windowId);
    const stays = !!active && (inPinnedContainer(after, active) || !spaceId || !!after.spaces[spaceId]?.tabIds.includes(active));
    if (stays) return;
    const inSpace = (spaceId ? after.spaces[spaceId]?.tabIds ?? [] : []).map((id) => after.tabs[id]).filter((t): t is Tab => !!t);
    const pick = [...inSpace].sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0];
    if (pick) get().activate(pick.id);
    else get().newTab(windowId);
  },

  moveTabsToSpace(windowId, tabIds, spaceId) {
    const s = get();
    if (!s.windows[windowId]) return;
    if (spaceId && s.spaces[spaceId]?.windowId !== windowId) return;
    let next: BrowserState = s;
    const moving = tabIds.filter((id) => s.tabs[id]?.windowId === windowId && !inPinnedContainer(s, id));
    for (const id of moving) next = withTabInSpace(next, id, spaceId);
    set({ spaces: next.spaces });
    const after = get();
    const active = activeTabId(after, windowId);
    if (!active || !moving.includes(active) || inPinnedContainer(after, active)) return;
    const visible = spaceVisibleTabIds(after, windowId);
    if (!visible || visible.has(active)) return;
    const first = after.windows[windowId]!.tabIds.map((id) => after.tabs[id]).find((t) => !!t && visible.has(t.id));
    if (first) get().activate(first.id);
    else get().newTab(windowId);
  },

  newTabInSpace(windowId, spaceId) {
    const s = get();
    if (!s.windows[windowId] || !s.spaces[spaceId] || s.spaces[spaceId]!.windowId !== windowId) return "";
    get().switchSpace(windowId, spaceId);
    return get().newTab(windowId);
  },
});

const spaceFrom = (o: unknown): Space | null => {
  if (!isFields(o) || !isString(o.id) || !isString(o.windowId) || !isString(o.name) || !isStringList(o.tabIds) || typeof o.createdAt !== "number") return null;
  const color = isString(o.color) && (GROUP_COLOR_ORDER as readonly string[]).includes(o.color) ? (o.color as GroupTint) : GROUP_COLOR_ORDER[0]!;
  return { id: o.id, windowId: o.windowId, name: o.name, color, tabIds: o.tabIds, createdAt: o.createdAt };
};

export function parseSpacesDoc(json: string | null | undefined): Pick<BrowserState, "spaces" | "activeSpaceId"> | null {
  const raw = parseSaved(json, SPACES_VERSION);
  if (!raw) return null;
  const spaces = Object.fromEntries(
    (Array.isArray(raw.spaces) ? raw.spaces : []).map((o) => spaceFrom(o)).filter((x): x is Space => !!x).map((x) => [x.id, x]),
  );
  const activeSpaceId = isFields(raw.activeSpaceId)
    ? Object.fromEntries(Object.entries(raw.activeSpaceId).filter(([, v]) => v === null || isString(v)).map(([k, v]) => [k, v as string | null]))
    : {};
  return { spaces, activeSpaceId };
}

export const savedSpaces = (s: Pick<BrowserState, "spaces" | "windows" | "tabs">): Space[] => {
  const kept = new Set(Object.values(s.windows).filter(isRegularWindow).map((w) => w.id));
  return Object.values(s.spaces)
    .filter((space) => kept.has(space.windowId))
    .map((space) => ({ ...space, tabIds: space.tabIds.filter((id) => s.tabs[id]?.windowId === space.windowId) }));
};

export const savedActiveSpaceId = (s: Pick<BrowserState, "spaces" | "activeSpaceId" | "windows">): Record<string, string | null> => {
  const kept = new Set(Object.values(s.windows).filter(isRegularWindow).map((w) => w.id));
  return Object.fromEntries(
    Object.entries(s.activeSpaceId).filter(([windowId, spaceId]) => kept.has(windowId) && (spaceId === null || !!s.spaces[spaceId])),
  );
};
