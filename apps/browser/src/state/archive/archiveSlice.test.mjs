import assert from "node:assert/strict";
import { test } from "node:test";
const { useBrowser } = await import("../browser/store.ts");

const S = () => useBrowser.getState();
const reset = () => S().hydrate({});
const item = (id, url, profileId = "default") => ({ id, title: `Page ${id}`, url, host: new URL(url).host, profileId });

test("the slice archives closed tabs, restores them into a window, and auto-archives idle tabs", () => {
  reset();
  const w = S().createWindow({ url: "https://home.test/" });
  const a = S().newTab(w, { url: "https://a.test/", background: true });
  const b = S().newTab(w, { url: "https://b.test/", background: true });
  S().archiveClosedTabs([item(a, "https://a.test/")], "default");
  assert.equal(S().archiveEntries.length, 1);
  assert.equal(S().archiveEntries[0].reason, "closed");
  const opened = S().restoreArchived(S().archiveEntries[0].id, w);
  assert.equal(opened.length, 1);
  assert.equal(S().archiveEntries.length, 0);
  assert.ok(S().tabs[opened[0]].url.includes("a.test"));

  S().updateSettings({ archiveAfter: 12 });
  const now = Date.now();
  S().noteTabActive(a, now - 13 * 3_600_000);
  S().noteTabActive(b, now - 13 * 3_600_000);
  const archived = S().archiveIdleTabs(now);
  assert.deepEqual(archived.sort(), [a, b].sort());
  assert.equal(S().archiveEntries.length, 2);
  assert.ok(S().archiveEntries.every((e) => e.reason === "auto"));
  assert.equal(S().tabs[a], undefined);
  assert.equal(S().tabs[b], undefined);

  S().updateSettings({ archiveAfter: 0 });
  const c = S().newTab(w, { url: "https://c.test/", background: true });
  S().noteTabActive(c, now - 99 * 3_600_000);
  assert.deepEqual(S().archiveIdleTabs(now), []);
});

test("the slice hydrates archived entries from a saved session and drops malformed rows", () => {
  reset();
  S().hydrate({
    archiveEntries: [
      { id: "ok", items: [{ id: "ok", title: "Ok", url: "https://ok.test/", host: "ok.test", profileId: "default" }], spaceId: "default", title: "Ok", url: "https://ok.test/", host: "ok.test", archivedAt: Date.now(), reason: "closed" },
      { id: "bad", items: [], spaceId: "default", title: "Bad", archivedAt: Date.now(), reason: "closed" },
    ],
  });
  assert.equal(S().archiveEntries.length, 1);
  assert.equal(S().archiveEntries[0].id, "ok");
  S().removeFromArchive("ok");
  assert.equal(S().archiveEntries.length, 0);
});

test("closing a tab files it in the archive, and the idle scan keeps its auto reason", () => {
  reset();
  const w = S().createWindow({ url: "https://home.test/" });
  const a = S().newTab(w, { url: "https://a.test/", background: true });
  const b = S().newTab(w, { url: "https://b.test/", background: true });
  S().closeTab(a);
  assert.equal(S().archiveEntries.length, 1);
  assert.equal(S().archiveEntries[0].reason, "closed");
  assert.equal(S().archiveEntries[0].spaceId, "default");
  S().updateSettings({ archiveAfter: 12 });
  const now = Date.now();
  S().noteTabActive(b, now - 13 * 3_600_000);
  assert.deepEqual(S().archiveIdleTabs(now), [b]);
  assert.equal(S().archiveEntries.length, 2);
  assert.equal(S().archiveEntries.find((e) => e.id === b)?.reason, "auto");
});
