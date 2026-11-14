export type PaletteTab = { id: string; title: string; url: string; spaceId: string };
export type PaletteHistory = { id: string; title: string; url: string; visits: number; lastVisited: number };

export type PaletteSuggestion =
  | { kind: "tab"; text: string; tabId: string; url: string }
  | { kind: "history"; text: string; historyId: string; url: string }
  | { kind: "url"; text: string }
  | { kind: "search"; text: string };

export function paletteWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

export function palettePageKey(url: string): string {
  let key: string;
  try {
    const parsed = new URL(url);
    key = `${parsed.host}${parsed.pathname}${parsed.search}`;
  } catch {
    key = url;
  }
  if (key.startsWith("www.")) key = key.slice(4);
  if (key.endsWith("/")) key = key.slice(0, -1);
  return key.toLowerCase();
}

export function isLikelyPaletteUrl(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return true;
  if (/\s/.test(trimmed)) return false;
  const host = trimmed.split(/[/?#]/)[0]!;
  if (host === "localhost" || host.startsWith("localhost:")) return true;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(host) || host.startsWith("[") || host.includes("::")) return true;
  return /^([\p{L}\p{N}-]+\.)+\p{L}[\p{L}\p{N}-]+(:\d+)?$/u.test(host);
}

export function primaryPaletteSuggestion(typed: string, autofillHost?: string | null): PaletteSuggestion | null {
  const text = typed.trim();
  if (!text) return null;
  if (autofillHost && autofillHost.length > text.length && autofillHost.toLowerCase().startsWith(text.toLowerCase())) {
    return { kind: "url", text: autofillHost };
  }
  return { kind: isLikelyPaletteUrl(text) ? "url" : "search", text };
}

export function visiblePaletteSuggestions(primary: PaletteSuggestion | null, found: readonly PaletteSuggestion[], limit = 5): PaletteSuggestion[] {
  if (!primary) return [...found].slice(0, limit);
  const rest = found.filter((row) => {
    if (row.kind === "tab" || row.kind === "history") return true;
    return row.text.toLowerCase() !== primary.text.toLowerCase();
  });
  return [primary, ...rest].slice(0, limit);
}

export function rankPaletteTabs(tabs: readonly PaletteTab[], query: string, currentSpaceId: string | null, selectedTabId: string | null, limit = 3): PaletteSuggestion[] {
  const words = paletteWords(query);
  if (!words.length) return [];
  const here = new Set(tabs.filter((t) => t.spaceId === currentSpaceId).map((t) => t.id));
  const matches = tabs
    .filter((t) => t.id !== selectedTabId)
    .map((t) => ({ tab: t, haystack: `${t.title} ${t.url}`.toLowerCase() }))
    .filter(({ haystack }) => words.every((w) => haystack.includes(w)));
  matches.sort((a, b) => {
    const aTitle = words.every((w) => a.tab.title.toLowerCase().includes(w));
    const bTitle = words.every((w) => b.tab.title.toLowerCase().includes(w));
    if (aTitle !== bTitle) return aTitle ? -1 : 1;
    const aHere = here.has(a.tab.id);
    const bHere = here.has(b.tab.id);
    if (aHere !== bHere) return aHere ? -1 : 1;
    return a.tab.title.length - b.tab.title.length;
  });
  return matches.slice(0, limit).map(({ tab }) => ({ kind: "tab", text: tab.title, tabId: tab.id, url: tab.url }) as PaletteSuggestion);
}

export function rankPaletteHistory(entries: readonly PaletteHistory[], query: string, limit = 3): PaletteSuggestion[] {
  const words = paletteWords(query);
  if (!words.length) return [];
  const matches = entries.filter((e) => words.every((w) => `${e.title} ${e.url}`.toLowerCase().includes(w)));
  matches.sort((a, b) => {
    const aTitle = words.every((w) => a.title.toLowerCase().includes(w));
    const bTitle = words.every((w) => b.title.toLowerCase().includes(w));
    if (aTitle !== bTitle) return aTitle ? -1 : 1;
    if (a.visits !== b.visits) return b.visits - a.visits;
    return b.lastVisited - a.lastVisited;
  });
  return matches.slice(0, limit).map((e) => ({ kind: "history", text: e.title, historyId: e.id, url: e.url }) as PaletteSuggestion);
}

export function composePaletteSuggestions(input: {
  tabs: readonly PaletteSuggestion[];
  history: readonly PaletteSuggestion[];
  text: readonly PaletteSuggestion[];
  web: readonly PaletteSuggestion[];
  limit?: number;
}): PaletteSuggestion[] {
  const { tabs, history, text, web, limit = 5 } = input;
  const open = new Set(tabs.filter((r): r is Extract<PaletteSuggestion, { kind: "tab" }> => r.kind === "tab").map((r) => palettePageKey(r.url)));
  const historyRows = history
    .filter((r) => (r.kind === "history" ? !open.has(palettePageKey(r.url)) : true))
    .slice(0, 3);
  const shown = new Set([
    ...open,
    ...historyRows.filter((r): r is Extract<PaletteSuggestion, { kind: "history" }> => r.kind === "history").map((r) => palettePageKey(r.url)),
  ]);
  const textRows = text.filter((r) => r.kind === "history" && !shown.has(palettePageKey(r.url))).slice(0, 3);
  return [...tabs, ...historyRows, ...textRows, ...web].slice(0, limit);
}

export function paletteDisplayText(suggestion: PaletteSuggestion): string {
  if (suggestion.kind === "tab" || suggestion.kind === "history") return suggestion.url.replace(/^https?:\/\//, "");
  return suggestion.text;
}
