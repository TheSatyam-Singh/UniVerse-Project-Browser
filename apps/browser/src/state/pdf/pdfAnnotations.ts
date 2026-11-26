import { create } from "zustand";
import { capture } from "../telemetry/client";

export type HighlightColor = "yellow" | "green" | "pink" | "blue";

export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: "#ffd60a",
  green: "#30d158",
  pink: "#ff6482",
  blue: "#0a84ff",
};

export type PdfHighlight = { id: string; page: number; para: number; color: HighlightColor };

type PdfAnnotationsState = {
  highlights: Record<string, PdfHighlight[]>;
  fieldValues: Record<string, Record<string, string | boolean>>;
  toggleHighlight: (pdfUrl: string, page: number, para: number, color: HighlightColor) => void;
  removeHighlight: (pdfUrl: string, id: string) => void;
  setFieldValue: (pdfUrl: string, name: string, value: string | boolean) => void;
};

export const usePdfAnnotations = create<PdfAnnotationsState>()((set) => ({
  highlights: {},
  fieldValues: {},
  toggleHighlight: (pdfUrl, page, para, color) =>
    set((s) => {
      const list = s.highlights[pdfUrl] ?? [];
      const existing = list.find((h) => h.page === page && h.para === para);
      if (existing) {
        if (existing.color === color) {
          return { highlights: { ...s.highlights, [pdfUrl]: list.filter((h) => h.id !== existing.id) } };
        }
        return { highlights: { ...s.highlights, [pdfUrl]: list.map((h) => (h.id === existing.id ? { ...h, color } : h)) } };
      }
      capture("pdf_highlight_added", { color });
      return {
        highlights: {
          ...s.highlights,
          [pdfUrl]: [...list, { id: `${page}-${para}-${Date.now()}`, page, para, color }],
        },
      };
    }),
  removeHighlight: (pdfUrl, id) =>
    set((s) => ({ highlights: { ...s.highlights, [pdfUrl]: (s.highlights[pdfUrl] ?? []).filter((h) => h.id !== id) } })),
  setFieldValue: (pdfUrl, name, value) =>
    set((s) => ({ fieldValues: { ...s.fieldValues, [pdfUrl]: { ...(s.fieldValues[pdfUrl] ?? {}), [name]: value } } })),
}));
