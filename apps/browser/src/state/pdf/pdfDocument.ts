import * as pdfjsLib from "pdfjs-dist";

export type PdfOutlineItem = { title: string; page: number; items: PdfOutlineItem[] };

export type PdfDocumentInfo = {
  pageCount: number;
  title: string | null;
  author: string | null;
  outline: PdfOutlineItem[];
  pages: PdfPageText[];
  fields: PdfFormField[];
};

export type PdfPageText = { page: number; text: string };

export type PdfFormField = {
  page: number;
  name: string;
  kind: "text" | "checkbox" | "choice";
  value: string;
  options: string[];
};

export function paragraphsOf(text: string): string[] {
  const byBlank = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (byBlank.length > 1) return byBlank;
  return text
    .split(/\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function outlineItems(doc: pdfjsLib.PDFDocumentProxy, items: unknown[]): Promise<PdfOutlineItem[]> {
  const out: PdfOutlineItem[] = [];
  for (const item of items as { title: string; dest: unknown; items?: unknown[] }[]) {
    let page = 0;
    try {
      const dest = Array.isArray(item.dest)
        ? (item.dest as unknown[])
        : item.dest
          ? await doc.getDestination(item.dest as string)
          : null;
      if (dest && dest[0]) {
        const index = await doc.getPageIndex(dest[0]);
        page = index + 1;
      }
    } catch {
      page = 0;
    }
    out.push({ title: item.title ?? "", page, items: item.items ? await outlineItems(doc, item.items) : [] });
  }
  return out;
}

export async function loadPdfDocument(pdfUrl: string, signal?: AbortSignal): Promise<PdfDocumentInfo> {
  const res = await fetch(pdfUrl, { signal });
  if (!res.ok) throw new Error(`Could not load the PDF (HTTP ${res.status}).`);
  const buf = await res.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const meta = await doc.getMetadata().catch(() => null);
  const rawOutline = await doc.getOutline().catch(() => null);
  const outline = rawOutline ? await outlineItems(doc, rawOutline) : [];
  const pages: PdfPageText[] = [];
  const fields: PdfFormField[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push({
      page: n,
      text: content.items.map((i) => ("str" in i ? i.str + (i.hasEOL ? "\n" : " ") : "")).join(""),
    });
    const annotations = await page.getAnnotations().catch(() => []);
    for (const a of annotations) {
      if (a.subtype !== "Widget" || !a.fieldName) continue;
      if (a.fieldType === "Tx") {
        fields.push({ page: n, name: a.fieldName, kind: "text", value: typeof a.fieldValue === "string" ? a.fieldValue : "", options: [] });
      } else if (a.fieldType === "Btn") {
        fields.push({ page: n, name: a.fieldName, kind: "checkbox", value: typeof a.fieldValue === "string" ? a.fieldValue : "Off", options: [] });
      } else if (a.fieldType === "Ch") {
        const options = Array.isArray(a.options)
          ? a.options.map((o: unknown) => {
              if (typeof o === "object" && o !== null && "displayValue" in o) return String((o as { displayValue: unknown }).displayValue);
              return String(o);
            })
          : [];
        fields.push({ page: n, name: a.fieldName, kind: "choice", value: typeof a.fieldValue === "string" ? a.fieldValue : "", options });
      }
    }
  }
  return {
    pageCount: doc.numPages,
    title: (meta?.info as { Title?: string } | null)?.Title ?? null,
    author: (meta?.info as { Author?: string } | null)?.Author ?? null,
    outline,
    pages,
    fields,
  };
}
