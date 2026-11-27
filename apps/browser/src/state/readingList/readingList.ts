import { create } from "zustand";
import { readDocument, writeDocument } from "../../platform/documents";
import {
  parseReadingList,
  serializeReadingList,
  withReadingListItem,
  withoutReadingListItem,
  type ReadingListItem,
} from "./readingListDocument";

const DOCUMENT_NAME = "reading-list.json";
const SAVE_DELAY_MS = 500;

type ReadingListState = {
  items: ReadingListItem[];
  loaded: boolean;
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let loadStarted = false;

function saveNow(items: ReadingListItem[]) {
  try {
    writeDocument(DOCUMENT_NAME, serializeReadingList(items));
  } catch {
    return;
  }
}

function scheduleSave(items: ReadingListItem[]) {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveNow(items);
  }, SAVE_DELAY_MS);
}

export const useReadingList = create<ReadingListState>()(() => ({ items: [], loaded: false }));

export function loadReadingList() {
  if (useReadingList.getState().loaded || loadStarted) return;
  loadStarted = true;
  try {
    const text = readDocument(DOCUMENT_NAME);
    useReadingList.setState({ items: parseReadingList(text), loaded: true });
  } catch {
    useReadingList.setState({ loaded: true });
  }
}

export function addReadingList(item: ReadingListItem) {
  const next = withReadingListItem(useReadingList.getState().items, item);
  useReadingList.setState({ items: next });
  scheduleSave(next);
}

export function removeReadingList(url: string) {
  const items = useReadingList.getState().items;
  const next = withoutReadingListItem(items, url);
  if (next.length === items.length) return;
  useReadingList.setState({ items: next });
  scheduleSave(next);
}

export function clearReadingList() {
  if (useReadingList.getState().items.length === 0) return;
  useReadingList.setState({ items: [] });
  scheduleSave([]);
}
