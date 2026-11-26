import { hostOf } from "@universe/core";

export type SiteNote = { text: string; updatedAt: number };

export type NotesDoc = Record<string, SiteNote>;

const DOC_VERSION = 1;

export function noteHost(url: string | undefined): string {
  if (!url) return "";
  return hostOf(url);
}

export function parseNotes(text: string | null | undefined): NotesDoc {
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return {};
    const notes = (parsed as { notes?: unknown }).notes;
    if (!notes || typeof notes !== "object") return {};
    const out: NotesDoc = {};
    for (const [host, value] of Object.entries(notes as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const entry = value as { text?: unknown; updatedAt?: unknown };
      if (typeof entry.text !== "string") continue;
      out[host] = { text: entry.text, updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : 0 };
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeNotes(notes: NotesDoc): string {
  return JSON.stringify({ version: DOC_VERSION, notes });
}

export function noteHosts(notes: NotesDoc): string[] {
  return Object.entries(notes)
    .filter(([, note]) => note.text.trim().length > 0)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .map(([host]) => host);
}
