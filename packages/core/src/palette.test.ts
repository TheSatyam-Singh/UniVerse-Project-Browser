import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composePaletteSuggestions,
  isLikelyPaletteUrl,
  paletteDisplayText,
  palettePageKey,
  primaryPaletteSuggestion,
  rankPaletteHistory,
  rankPaletteTabs,
  visiblePaletteSuggestions,
  type PaletteHistory,
  type PaletteSuggestion,
  type PaletteTab,
} from "./palette.ts";

test("isLikelyPaletteUrl follows the host test: localhost and IPs are urls, bare words and decimals are searches", () => {
  assert.equal(isLikelyPaletteUrl("facebook.com"), true);
  assert.equal(isLikelyPaletteUrl("http://example.com/x"), true);
  assert.equal(isLikelyPaletteUrl("localhost:3000"), true);
  assert.equal(isLikelyPaletteUrl("192.168.1.140:8080/path"), true);
  assert.equal(isLikelyPaletteUrl("3.14"), false);
  assert.equal(isLikelyPaletteUrl("what."), false);
  assert.equal(isLikelyPaletteUrl("asp.net core"), false);
  assert.equal(isLikelyPaletteUrl("how to boil an egg"), false);
});

test("the primary suggestion is the Return row: completion host, then url, then search", () => {
  assert.equal(primaryPaletteSuggestion(""), null);
  assert.equal(primaryPaletteSuggestion("   "), null);
  assert.deepEqual(primaryPaletteSuggestion("face", "facebook.com"), { kind: "url", text: "facebook.com" });
  assert.deepEqual(primaryPaletteSuggestion("facebook.com"), { kind: "url", text: "facebook.com" });
  assert.deepEqual(primaryPaletteSuggestion("how to boil an egg"), { kind: "search", text: "how to boil an egg" });
  assert.deepEqual(primaryPaletteSuggestion("face", "other.com"), { kind: "search", text: "face" });
});

test("visible suggestions put the Return row first and drop a duplicate url or search row", () => {
  const found: PaletteSuggestion[] = [
    { kind: "search", text: "facebook.com" },
    { kind: "history", text: "Facebook", historyId: "h1", url: "https://facebook.com/" },
    { kind: "url", text: "facebook.com" },
    { kind: "tab", text: "Facebook", tabId: "t1", url: "https://facebook.com/" },
  ];
  const primary = primaryPaletteSuggestion("facebook.com")!;
  const visible = visiblePaletteSuggestions(primary, found);
  assert.equal(visible[0], primary);
  assert.equal(visible.slice(1).filter((r) => r.kind === "search" || r.kind === "url").length, 0);
  assert.ok(visible.some((r) => r.kind === "history"));
  assert.ok(visible.some((r) => r.kind === "tab"));
  assert.equal(visiblePaletteSuggestions(null, found, 2).length, 2);
});

test("tab ranking prefers title matches, then the current space, then shorter titles", () => {
  const tabs: PaletteTab[] = [
    { id: "a", title: "GitHub - a very long title about pull requests", url: "https://github.com/a", spaceId: "s1" },
    { id: "b", title: "GitHub", url: "https://github.com/b", spaceId: "s2" },
    { id: "c", title: "Docs", url: "https://github.com/c", spaceId: "s1" },
  ];
  const ranked = rankPaletteTabs(tabs, "github", "s1", null);
  assert.deepEqual(ranked.map((r) => (r.kind === "tab" ? r.tabId : "")), ["a", "b", "c"]);
  const currentFirst = rankPaletteTabs(
    [
      { id: "x", title: "GitHub", url: "https://github.com/x", spaceId: "s2" },
      { id: "y", title: "GitHub", url: "https://github.com/y", spaceId: "s1" },
    ],
    "github",
    "s1",
    null,
  );
  assert.equal(currentFirst[0]?.kind === "tab" ? currentFirst[0].tabId : "", "y");
  assert.equal(rankPaletteTabs(tabs, "github", "s1", "b").some((r) => r.kind === "tab" && r.tabId === "b"), false);
});

test("history ranking prefers title matches, then visits, then recency", () => {
  const now = Date.now();
  const entries: PaletteHistory[] = [
    { id: "u1", title: "Other", url: "https://example.com/github", visits: 50, lastVisited: now - 1000 },
    { id: "u2", title: "GitHub old", url: "https://github.com/old", visits: 2, lastVisited: now - 9000 },
    { id: "u3", title: "GitHub new", url: "https://github.com/new", visits: 2, lastVisited: now - 100 },
  ];
  const ranked = rankPaletteHistory(entries, "github");
  assert.deepEqual(ranked.map((r) => (r.kind === "history" ? r.historyId : "")), ["u3", "u2", "u1"]);
});

test("compose dedupes an open tab out of history and caps the list at five", () => {
  const tab: PaletteSuggestion = { kind: "tab", text: "GitHub", tabId: "t1", url: "https://github.com/" };
  const history: PaletteSuggestion[] = [
    { kind: "history", text: "GitHub", historyId: "h1", url: "https://github.com/" },
    { kind: "history", text: "GitHub Docs", historyId: "h2", url: "https://github.com/docs" },
  ];
  const text: PaletteSuggestion[] = [{ kind: "history", text: "GitHub Docs", historyId: "h2", url: "https://github.com/docs" }];
  const web: PaletteSuggestion[] = [
    { kind: "search", text: "github pricing" },
    { kind: "search", text: "github actions" },
    { kind: "search", text: "github copilot" },
  ];
  const composed = composePaletteSuggestions({ tabs: [tab], history, text, web });
  assert.equal(composed.length, 5);
  assert.equal(composed[0], tab);
  assert.equal(composed.filter((r) => r.kind === "history" && r.url === "https://github.com/").length, 0);
  assert.equal(composed.filter((r) => r.kind === "history" && r.historyId === "h2").length, 1);
});

test("page keys ignore scheme, www and a trailing slash; display text strips the scheme", () => {
  assert.equal(palettePageKey("https://www.example.com/path/"), palettePageKey("http://example.com/path"));
  assert.equal(paletteDisplayText({ kind: "tab", text: "Example", tabId: "t", url: "https://example.com/path" }), "example.com/path");
  assert.equal(paletteDisplayText({ kind: "search", text: "hello" }), "hello");
});
