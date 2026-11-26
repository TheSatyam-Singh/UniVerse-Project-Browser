export type ReaderBlockKind = "h1" | "h2" | "h3" | "p" | "li" | "quote";

export type ReaderBlock = { kind: ReaderBlockKind; text: string };

export type ReaderArticle = {
  url: string;
  title: string;
  byline: string;
  siteName: string;
  blocks: ReaderBlock[];
};

export type ExtractDocument = {
  title: string;
  location?: { hostname: string };
  querySelector: (selectors: string) => ExtractElement | null;
  querySelectorAll: (selectors: string) => ExtractElement[];
};

export type ExtractElement = {
  tagName: string;
  textContent: string | null;
  className: string;
  id: string;
  parentElement: ExtractElement | null;
  getAttribute: (name: string) => string | null;
  querySelectorAll: (selectors: string) => ExtractElement[];
  closest: (selectors: string) => ExtractElement | null;
};

export function extractArticle(doc: ExtractDocument): ReaderArticle | null {
  const stripTags = ["script", "style", "nav", "aside", "footer", "form", "iframe", "noscript", "button", "select", "input", "textarea"];
  const stripClass = /(ad|banner|cookie|popup|newsletter|share|comment|related|sidebar|menu|promo|subscribe|social|toolbar|header|footer)/i;
  const blockTags = ["h1", "h2", "h3", "p", "li", "blockquote"];
  const cleanText = (value: string | null | undefined): string => (value ?? "").replace(/\s+/g, " ").trim();
  const cleanTitle = (raw: string): string => {
    const parts = raw.split(/ [|–—-] /).map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1) return raw.trim();
    if (parts[0]!.length >= 8) return parts[0]!;
    return parts.reduce((a, b) => (a.length >= b.length ? a : b), "");
  };
  const isStripped = (el: ExtractElement): boolean => {
    if (stripTags.includes(el.tagName.toLowerCase())) return true;
    return stripClass.test(`${el.className} ${el.id}`);
  };
  const textOf = (el: ExtractElement): number => {
    let total = 0;
    for (const p of el.querySelectorAll("p")) total += cleanText(p.textContent).length;
    return total;
  };
  const pickCandidate = (): ExtractElement | null => {
    const preferred = doc.querySelector("article") ?? doc.querySelector("main") ?? doc.querySelector("[role=main]");
    if (preferred && textOf(preferred) >= 500) return preferred;
    let best: ExtractElement | null = null;
    let bestScore = 0;
    for (const el of doc.querySelectorAll("article, main, section, div")) {
      if (el.closest("nav, aside, footer, header, form")) continue;
      if (isStripped(el)) continue;
      const score = textOf(el);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best && bestScore >= 500) return best;
    return preferred;
  };
  const insideStripped = (el: ExtractElement): boolean => {
    let cur = el.parentElement;
    while (cur) {
      if (isStripped(cur)) return true;
      cur = cur.parentElement;
    }
    return false;
  };
  const candidate = pickCandidate();
  if (!candidate) return null;
  const meta = doc.querySelector("meta[name=author]");
  const bylineEl = doc.querySelector(".byline, .author, [rel=author]");
  const byline = cleanText(meta?.getAttribute("content") ?? bylineEl?.textContent ?? "");
  const blocks: ReaderBlock[] = [];
  let total = 0;
  for (const el of candidate.querySelectorAll(blockTags.join(","))) {
    if (el.closest("nav, aside, footer, header, form")) continue;
    if (isStripped(el) || insideStripped(el)) continue;
    const text = cleanText(el.textContent);
    if (!text) continue;
    const tag = el.tagName.toLowerCase();
    const kind: ReaderBlockKind = tag === "h1" || tag === "h2" || tag === "h3" ? (tag as ReaderBlockKind) : tag === "li" ? "li" : tag === "blockquote" ? "quote" : "p";
    if (kind === "p" && text.length < 20) continue;
    if (kind !== "p" && text.length < 4) continue;
    blocks.push({ kind, text });
    total += text.length;
    if (blocks.length >= 400) break;
  }
  if (total < 500 || blocks.length < 3) return null;
  return {
    url: "",
    title: cleanTitle(doc.title),
    byline,
    siteName: doc.location?.hostname ?? "",
    blocks,
  };
}
