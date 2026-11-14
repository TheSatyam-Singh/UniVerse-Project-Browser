import type { HistoryEntry } from "../browser/types";

export type PageTextMatch = { url: string; title: string; snippet: string };

export const PAGE_TEXT_INDEX_MAX_BODY_CHARS = 200_000;
export const PAGE_TEXT_INDEX_MAX_SNIPPET_WORDS = 12;

export function pageTextMatchExpression(query: string): string | null {
  const terms = query
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
    .map((word) => `"${word.replaceAll('"', '""')}"*`);
  return terms.length ? terms.join(" ") : null;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function snippetFor(title: string, body: string, terms: string[]): string {
  const words = `${title} ${body}`.split(/\s+/).filter(Boolean);
  const lowered = words.map((w) => w.toLowerCase());
  const at = lowered.findIndex((w) => terms.some((t) => w.startsWith(t)));
  if (at < 0) return words.slice(0, PAGE_TEXT_INDEX_MAX_SNIPPET_WORDS).join(" ");
  const start = Math.max(0, at - 4);
  const snippet = words.slice(start, start + PAGE_TEXT_INDEX_MAX_SNIPPET_WORDS).join(" ");
  return `${start > 0 ? "… " : ""}${snippet}${start + PAGE_TEXT_INDEX_MAX_SNIPPET_WORDS < words.length ? " …" : ""}`;
}

type PageTextRow = { url: string; title: string; body: string; visitedAt: number; tokens: Map<string, number>; titleTokens: Set<string> };

export class PageTextIndex {
  private rows = new Map<string, PageTextRow>();

  get size(): number {
    return this.rows.size;
  }

  record(url: string, title: string, body: string, visitedAt = Date.now()): void {
    if (!/^https?:\/\//.test(url)) return;
    const trimmed = body.slice(0, PAGE_TEXT_INDEX_MAX_BODY_CHARS);
    const tokens = new Map<string, number>();
    for (const token of tokenize(`${title} ${trimmed}`)) tokens.set(token, (tokens.get(token) ?? 0) + 1);
    const titleTokens = new Set(tokenize(title));
    this.rows.set(url, { url, title, body: trimmed, visitedAt, tokens, titleTokens });
  }

  delete(url: string): boolean {
    return this.rows.delete(url);
  }

  retain(only: ReadonlySet<string>): void {
    for (const url of [...this.rows.keys()]) if (!only.has(url)) this.delete(url);
  }

  erase(): void {
    this.rows.clear();
  }

  has(url: string): boolean {
    return this.rows.has(url);
  }

  search(query: string, limit = 10): PageTextMatch[] {
    if (limit <= 0) return [];
    const terms = query
      .split(/\s+/)
      .filter((word) => /[\p{L}\p{N}]/u.test(word))
      .map((word) => word.toLowerCase());
    if (!terms.length) return [];
    const matches = new Map<string, number>();
    for (const [url, row] of this.rows) {
      let score = 0;
      let matched = true;
      for (const term of terms) {
        let best = 0;
        let titleHit = false;
        for (const [token, count] of row.tokens) {
          if (!token.startsWith(term)) continue;
          best = Math.max(best, count);
          if (row.titleTokens.has(token)) titleHit = true;
        }
        if (!best) {
          matched = false;
          break;
        }
        score += best * (titleHit ? 3 : 1);
      }
      if (matched) matches.set(url, score);
    }
    return [...matches.entries()]
      .map(([url, score]) => ({ row: this.rows.get(url)!, score }))
      .sort((a, b) => b.score - a.score || b.row.visitedAt - a.row.visitedAt)
      .slice(0, limit)
      .map(({ row }) => ({ url: row.url, title: row.title, snippet: snippetFor(row.title, row.body, terms) }));
  }
}

export const pageTextIndex = new PageTextIndex();

export function searchHistoryPageText(
  entries: readonly HistoryEntry[],
  index: PageTextIndex,
  query: string,
  limit = 10,
): HistoryEntry[] {
  if (query.trim().length < 3) return [];
  const matches = index.search(query, limit * 3);
  if (!matches.length) return [];
  const byUrl = new Map(entries.map((e) => [e.url, e]));
  const out: HistoryEntry[] = [];
  for (const match of matches) {
    const entry = byUrl.get(match.url);
    if (entry && !out.includes(entry)) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

export function searchHistoryEntries(
  entries: readonly HistoryEntry[],
  query: string,
  options: { searchPageText: boolean; index?: PageTextIndex; limit?: number },
): HistoryEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const limit = options.limit ?? 50;
  if (!words.length) return [...entries].slice(0, limit);
  const titleUrl = entries.filter((e) => words.every((w) => `${e.title} ${e.url}`.toLowerCase().includes(w)));
  if (!options.searchPageText || !options.index) return titleUrl.slice(0, limit);
  const seen = new Set(titleUrl.map((e) => e.url));
  const text = searchHistoryPageText(entries, options.index, query, limit).filter((e) => !seen.has(e.url));
  return [...titleUrl, ...text].slice(0, limit);
}
