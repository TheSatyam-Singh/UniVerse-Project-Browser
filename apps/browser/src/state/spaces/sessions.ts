import type { StateCreator } from "zustand";
import { inPinnedContainer, newId } from "../browser/model";
import type { BrowserState } from "../browser/store";
import type { ClosedWindow, Tab } from "../browser/types";
import { MAX_CLOSED_WINDOWS } from "../pins/closedTabs";
import { closedWindowOf } from "../windows/closedWindow";
import { isFields, isString } from "../../lib/decode";
import { parseSaved } from "../../lib/savedDocument";
import { snapshotFrom } from "./archived";

export const SESSIONS_DOCUMENT = "sessions.json";
export const SESSIONS_VERSION = 1;
export const MAX_SAVED_SESSIONS = 20;

export type SavedSession = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  closedWindow: ClosedWindow;
};

export type SessionsSlice = {
  sessions: SavedSession[];

  saveSession(windowId: string, name?: string): string;
  renameSession(id: string, name: string): void;
  deleteSession(id: string): void;
  restoreSession(id: string, windowId?: string): void;
};

export const savedSessions = (s: Pick<BrowserState, "sessions">): SavedSession[] => s.sessions;

export const createSessionsSlice: StateCreator<BrowserState, [], [], SessionsSlice> = (set, get) => ({
  sessions: [],

  saveSession(windowId, name) {
    const s = get();
    const w = s.windows[windowId];
    if (!w) return "";
    const tabs = w.tabIds.map((id) => s.tabs[id]).filter((t): t is Tab => !!t && !!t.url && !inPinnedContainer(s, t.id));
    if (!tabs.length) return "";
    const trimmed = (name ?? "").trim();
    const existing = trimmed ? s.sessions.find((x) => x.name === trimmed) : undefined;
    const entry = closedWindowOf(s, w, tabs, false);
    const now = Date.now();
    const session: SavedSession = existing
      ? { ...existing, updatedAt: now, closedWindow: entry }
      : { id: newId("session"), name: trimmed || `Session ${s.sessions.length + 1}`, createdAt: now, updatedAt: now, closedWindow: entry };
    const sessions = (existing ? s.sessions.map((x) => (x.id === existing.id ? session : x)) : [session, ...s.sessions]).slice(0, MAX_SAVED_SESSIONS);
    set({ sessions });
    return session.id;
  },

  renameSession(id, name) {
    const s = get();
    const session = s.sessions.find((x) => x.id === id);
    const trimmed = name.trim();
    if (!session || !trimmed || session.name === trimmed) return;
    set({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, name: trimmed, updatedAt: Date.now() } : x)) });
  },

  deleteSession(id) {
    const s = get();
    if (!s.sessions.some((x) => x.id === id)) return;
    set({ sessions: s.sessions.filter((x) => x.id !== id) });
  },

  restoreSession(id, windowId) {
    const s = get();
    const session = s.sessions.find((x) => x.id === id);
    if (!session) return;
    set({ closedWindows: [session.closedWindow, ...s.closedWindows].slice(0, MAX_CLOSED_WINDOWS) });
    get().restoreClosed(session.closedWindow.id, windowId);
  },
});

const frameFrom = (v: unknown): [number, number, number, number] | null =>
  Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === "number") ? (v as [number, number, number, number]) : null;

const closedWindowFrom = (o: unknown): ClosedWindow | null => {
  if (!isFields(o) || !isString(o.id) || !isFields(o.window) || !isString(o.window.profileId) || !Array.isArray(o.tabs) || typeof o.closedAt !== "number") return null;
  const tabs = o.tabs.map((t) => {
    const snapshot = snapshotFrom(t);
    if (!snapshot || typeof (t as { active?: unknown }).active !== "boolean") return null;
    return { ...snapshot, active: (t as { active: boolean }).active };
  });
  if (tabs.some((t) => !t)) return null;
  const groups = Array.isArray(o.groups)
    ? o.groups.map((g) => {
        if (!isFields(g) || !isString(g.id) || !isString(g.name) || !Array.isArray(g.tabIndexes)) return null;
        const tabIndexes = g.tabIndexes.filter((i): i is number => typeof i === "number");
        if (tabIndexes.length !== g.tabIndexes.length) return null;
        return {
          id: g.id,
          profileId: isString(g.profileId) ? g.profileId : "",
          name: g.name,
          icon: isString(g.icon) ? g.icon : null,
          color: isString(g.color) ? g.color : null,
          collapsed: g.collapsed === true,
          pinned: g.pinned === true,
          createdAt: typeof g.createdAt === "number" ? g.createdAt : 0,
          ...(isString(g.parentId) ? { parentId: g.parentId } : {}),
          tabIndexes,
        };
      })
    : [];
  if (groups.some((g) => !g)) return null;
  const frame = frameFrom(o.window.frame);
  return {
    kind: "window",
    id: o.id,
    window: {
      profileId: o.window.profileId,
      frame: frame ?? null,
      ...(isString(o.window.tabLayout) ? { tabLayout: o.window.tabLayout as ClosedWindow["window"]["tabLayout"] } : {}),
      ...(typeof o.window.autoHideTabs === "boolean" ? { autoHideTabs: o.window.autoHideTabs } : {}),
    },
    tabs: tabs as ClosedWindow["tabs"],
    groups: groups as ClosedWindow["groups"],
    ...(Array.isArray(o.splits) ? { splits: o.splits as ClosedWindow["splits"] } : {}),
    closedAt: o.closedAt,
  };
};

const sessionFrom = (o: unknown): SavedSession | null => {
  if (!isFields(o) || !isString(o.id) || !isString(o.name) || typeof o.createdAt !== "number" || typeof o.updatedAt !== "number") return null;
  const closedWindow = closedWindowFrom(o.closedWindow);
  if (!closedWindow) return null;
  return { id: o.id, name: o.name, createdAt: o.createdAt, updatedAt: o.updatedAt, closedWindow };
};

export function parseSessionsDoc(json: string | null | undefined): Pick<BrowserState, "sessions"> | null {
  const raw = parseSaved(json, SESSIONS_VERSION);
  if (!raw) return null;
  const sessions = (Array.isArray(raw.sessions) ? raw.sessions : [])
    .map((o) => sessionFrom(o))
    .filter((x): x is SavedSession => !!x)
    .slice(0, MAX_SAVED_SESSIONS);
  return { sessions };
}
