import assert from "node:assert/strict";
import { test } from "node:test";
const {
  addArchiveEntry,
  archiveEntryFor,
  archiveRestoreUrls,
  idleArchiveRoots,
  mergeArchiveEntries,
  parseArchiveEntries,
  removeArchivedContaining,
  trimArchive,
} = await import("./archive.ts");
const item = (id, url, profileId = "default") => ({ id, title: `Page ${id}`, url, host: new URL(url).host, profileId });
const entry = (id, url, at) => {
  const made = archiveEntryFor([item(id, url)], "default", "closed", at);
  assert.ok(made);
  return made;
};

test("an entry keeps its space, timestamp and reason, and a second add of the same id replaces it", () => {
  const first = entry("a", "https://example.com/", 1000);
  assert.equal(first.spaceId, "default");
  assert.equal(first.archivedAt, 1000);
  assert.equal(first.reason, "closed");
  assert.equal(first.host, "example.com");
  const added = addArchiveEntry([], first);
  assert.equal(added.length, 1);
  const again = addArchiveEntry(added, entry("a", "https://example.com/other", 2000));
  assert.equal(again.length, 1);
  assert.equal(again[0].url, "https://example.com/other");
});

test("trimming drops entries older than thirty days and caps the list at one thousand", () => {
  const now = Date.now();
  const old = entry("old", "https://old.test/", now - 31 * 86_400_000);
  const kept = trimArchive([old, entry("new", "https://new.test/", now)], now);
  assert.deepEqual(kept.map((e) => e.id), ["new"]);
  const many = Array.from({ length: 1005 }, (_, i) => entry(`e${i}`, `https://x.test/${i}`, now));
  assert.equal(trimArchive(many, now).length, 1000);
  assert.equal(trimArchive(many, now)[0].id, "e5");
});

test("merging keeps oldest first and removing drops every entry holding a restored id", () => {
  const now = Date.now();
  const merged = mergeArchiveEntries([entry("b", "https://b.test/", now - 1000)], [entry("a", "https://a.test/", now)], now);
  assert.deepEqual(merged.map((e) => e.id), ["b", "a"]);
  const { entries, removed } = removeArchivedContaining(merged, new Set(["a"]));
  assert.equal(removed, true);
  assert.deepEqual(entries.map((e) => e.id), ["b"]);
  assert.equal(removeArchivedContaining(entries, new Set(["zzz"])).removed, false);
});

test("parsing drops malformed rows and restore urls skip folders", () => {
  const now = Date.now();
  const parsed = parseArchiveEntries([
    { id: "ok", items: [{ id: "ok", title: "Ok", url: "https://ok.test/", profileId: "default" }], spaceId: "default", title: "Ok", archivedAt: now, reason: "closed" },
    { id: "bad", items: [], spaceId: "default", title: "Bad", archivedAt: now, reason: "closed" },
    { nope: true },
    "junk",
  ]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, "ok");
  const folder = archiveEntryFor(
    [
      { id: "f", title: "Folder", url: "", host: null, profileId: "default", isFolder: true },
      { id: "c", title: "Child", url: "https://child.test/", host: "child.test", profileId: "default", parentId: "f" },
    ],
    "default",
    "closed",
    1000,
  );
  assert.deepEqual(archiveRestoreUrls(folder), ["https://child.test/"]);
});

test("idle roots are unopened top-level tabs past the interval, and un-stamped tabs start their clock now", () => {
  const now = 10_000_000;
  const hour = 3_600_000;
  const tabs = [
    { id: "idle", profileId: "default", lastActive: now - 13 * hour },
    { id: "fresh", profileId: "default", lastActive: now - hour },
    { id: "folder", profileId: "default", isFolder: true },
    { id: "child", profileId: "default", parentId: "folder", lastActive: now - 13 * hour },
    { id: "agent", profileId: "default", isAgentSpace: true, lastActive: now - 13 * hour },
    { id: "new", profileId: "default" },
  ];
  const stamps = { idle: now - 13 * hour, fresh: now - hour };
  const { roots, lastActive } = idleArchiveRoots(tabs, stamps, 12 * hour, new Set(["fresh"]), now);
  assert.deepEqual(roots, ["idle"]);
  assert.equal(lastActive.new, now);
  const shielded = idleArchiveRoots(tabs, stamps, 12 * hour, new Set(["idle", "fresh"]), now);
  assert.deepEqual(shielded.roots, []);
});
