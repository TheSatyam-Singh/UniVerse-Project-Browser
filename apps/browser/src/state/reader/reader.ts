import { create } from "zustand";
import { webviews } from "../../platform/webviews";
import { useBrowser } from "../browser/store";
import { capture } from "../telemetry/client";
import { extractArticle, type ReaderArticle } from "./extractArticle";

export type ReaderFont = "serif" | "sans" | "mono";
export type ReaderSize = "s" | "m" | "l" | "xl";
export type ReaderTheme = "light" | "sepia" | "dark";

export type ReaderEntry = { sourceUrl: string; article: ReaderArticle | null };

type ReaderState = {
  entries: Record<string, ReaderEntry>;
  font: ReaderFont;
  size: ReaderSize;
  theme: ReaderTheme;
  setFont: (font: ReaderFont) => void;
  setSize: (size: ReaderSize) => void;
  setTheme: (theme: ReaderTheme) => void;
  openReader: (tabId: string) => Promise<void>;
  closeReader: (tabId: string) => void;
};

export const READER_URL = "universe://reader";

export const useReader = create<ReaderState>()((set, get) => ({
  entries: {},
  font: "serif",
  size: "m",
  theme: "light",
  setFont: (font) => set({ font }),
  setSize: (size) => set({ size }),
  setTheme: (theme) => set({ theme }),
  openReader: async (tabId) => {
    const tab = useBrowser.getState().tabs[tabId];
    if (!tab || tab.url.startsWith("universe://")) return;
    const web = webviews.get(tabId);
    if (!web) return;
    let article: ReaderArticle | null = null;
    try {
      article = await web.evaluate<ReaderArticle | null>(`(${extractArticle.toString()})(document)`);
    } catch {
      article = null;
    }
    if (article) article = { ...article, url: tab.url };
    set((s) => ({ entries: { ...s.entries, [tabId]: { sourceUrl: tab.url, article } } }));
    capture("reader_opened", { found: !!article });
    useBrowser.getState().navigate(tabId, READER_URL);
  },
  closeReader: (tabId) => {
    const entry = get().entries[tabId];
    if (!entry) return;
    set((s) => {
      const entries = { ...s.entries };
      delete entries[tabId];
      return { entries };
    });
    useBrowser.getState().navigate(tabId, entry.sourceUrl);
  },
}));
