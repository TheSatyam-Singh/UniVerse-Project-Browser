import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyArcArchive,
  arcArchiveEntries,
  arcImportSummary,
  arcRoutesToSiteRules,
  countArcFolders,
} from "./arcDepth.ts";
import { useBrowser } from "../browser/store.ts";

const spaces = new Map([
  ["s1", "p1"],
  ["s2", "p2"],
]);

test("arc routes become site rules, duplicates and bad patterns are skipped", () => {
  const existing = [{ id: "e1", domain: "old.example", targetProfileId: "p1", isEnabled: true }];
  const { added, skipped } = arcRoutesToSiteRules(
    [
      { pattern: "https://news.example/tech", spaceID: "s1" },
      { pattern: "news.example", spaceID: "s2" },
      { pattern: "old.example", spaceID: "s1" },
      { pattern: "example.com/*/x", spaceID: "s1" },
      { pattern: "news.example", spaceID: "missing" },
    ],
    spaces,
    existing,
  );
  assert.equal(added.length, 2);
  assert.equal(added[0].domain, "news.example");
  assert.equal(added[0].pathPrefix, "/tech");
  assert.equal(added[0].targetProfileId, "p1");
  assert.equal(added[1].domain, "news.example");
  assert.equal(added[1].pathPrefix, undefined);
  assert.equal(added[1].targetProfileId, "p2");
  assert.equal(skipped, 3);
});

test("arc archive entries keep recent http(s) tabs from known spaces, once each", () => {
  const now = Date.now();
  const day = 86_400_000;
  const items = [
    { spaceID: "s1", url: "https://example.com/a", title: "A", archivedAt: (now - day) / 1000, auto: true },
    { spaceID: "s1", url: "https://example.com/a", title: "A", archivedAt: (now - day) / 1000, auto: true },
    { spaceID: "s1", url: "https://example.com/old", title: "Old", archivedAt: (now - 31 * day) / 1000, auto: false },
    { spaceID: "s1", url: "file:///tmp/x", title: "File", archivedAt: now / 1000, auto: false },
    { spaceID: "gone", url: "https://example.com/b", title: "B", archivedAt: now / 1000, auto: false },
    { spaceID: "s2", url: "https://example.com/c", title: "C", archivedAt: now / 1000, auto: false },
  ];
  const entries = arcArchiveEntries(items, spaces, [{ url: "https://example.com/c", archivedAt: now }], now);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].url, "https://example.com/a");
  assert.equal(entries[0].spaceId, "p1");
  assert.equal(entries[0].auto, true);
  assert.equal(entries[0].archivedAt, now - day);
});

test("arc import summary lists only nonzero counts, Oxford-style", () => {
  assert.equal(arcImportSummary(2, 87, 12, 3, 14), "2 spaces, 87 tabs, 12 folders, 3 Air Traffic Control rules and 14 archived tabs.");
  assert.equal(arcImportSummary(1, 0, 0, 1, 0), "1 space and 1 Air Traffic Control rule.");
  assert.equal(arcImportSummary(0, 0, 0, 0, 0), "");
});

test("folder count walks the pinned tree", () => {
  const nodes = [
    { type: "folder", title: "A", children: [
      { type: "folder", title: "B", children: [{ type: "url", title: "x", url: "https://example.com" }] },
      { type: "url", title: "y", url: "https://example.com" },
    ] },
    { type: "url", title: "z", url: "https://example.com" },
  ];
  assert.equal(countArcFolders(nodes), 2);
});

test("applying arc archived tabs files them in the archive store, once each", () => {
  const S = () => useBrowser.getState();
  S().hydrate({});
  const now = Date.now();
  const day = 86_400_000;
  const items = [
    { spaceID: "s1", url: "https://example.com/a", title: "A", archivedAt: (now - day) / 1000, auto: false },
    { spaceID: "s1", url: "https://example.com/b", title: "B", archivedAt: (now - day) / 1000, auto: true },
    { spaceID: "gone", url: "https://example.com/c", title: "C", archivedAt: now / 1000, auto: false },
  ];
  const out = applyArcArchive(items, spaces);
  assert.equal(out.archived, 2);
  assert.equal(out.skipped, 1);
  assert.equal(S().archiveEntries.length, 2);
  assert.equal(S().archiveEntries.find((e) => e.url === "https://example.com/a")?.reason, "closed");
  assert.equal(S().archiveEntries.find((e) => e.url === "https://example.com/b")?.reason, "auto");
  assert.equal(S().archiveEntries.find((e) => e.url === "https://example.com/b")?.archivedAt, now - day);
  const again = applyArcArchive(items, spaces);
  assert.equal(again.archived, 0);
  assert.equal(S().archiveEntries.length, 2);
});
