import { create } from "zustand";
import { readDocument, writeDocument } from "../../platform/documents";
import { noteHosts, parseNotes, serializeNotes, type NotesDoc, type SiteNote } from "./noteDocument";

const DOCUMENT_NAME = "notes.json";
const SAVE_DELAY_MS = 500;

type NotesState = {
  notes: NotesDoc;
  loaded: boolean;
  loadNotes: () => void;
  setNote: (host: string, text: string) => void;
  deleteNote: (host: string) => void;
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let loadStarted = false;

function saveNow(notes: NotesDoc) {
  try {
    writeDocument(DOCUMENT_NAME, serializeNotes(notes));
  } catch {
    return;
  }
}

function scheduleSave(notes: NotesDoc) {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveNow(notes);
  }, SAVE_DELAY_MS);
}

export const useNotes = create<NotesState>()((set, get) => ({
  notes: {},
  loaded: false,
  loadNotes: () => {
    if (get().loaded || loadStarted) return;
    loadStarted = true;
    try {
      const text = readDocument(DOCUMENT_NAME);
      set({ notes: parseNotes(text), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  setNote: (host, text) => {
    if (!host) return;
    const next: NotesDoc = { ...get().notes };
    if (text.trim().length === 0) delete next[host];
    else next[host] = { text, updatedAt: Date.now() } satisfies SiteNote;
    set({ notes: next });
    scheduleSave(next);
  },
  deleteNote: (host) => {
    const next: NotesDoc = { ...get().notes };
    delete next[host];
    set({ notes: next });
    scheduleSave(next);
  },
}));

export const noteHostsOf = (notes: NotesDoc): string[] => noteHosts(notes);
