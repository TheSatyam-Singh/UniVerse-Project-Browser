import assert from "node:assert/strict";
import { test } from "node:test";

const { recentlyClosedTabs, MAX_RECENTLY_CLOSED } = await import("./recentlyClosed.ts");

const entry = (id, profileId, title, closedAt) => ({
  id,
  kind: "tab",
  tab: { url: `https://${title}.com/`, title, profileId },
  windowId: "w",
  index: 0,
  group: null,
  closedAt,
});

test("the History page lists only the profile's closed tabs, newest first", () => {
  const s = {
    closedTabs: [
      entry("old", "default", "old", 100),
      entry("other", "work", "other", 300),
      entry("new", "default", "new", 200),
    ],
  };
  assert.deepEqual(
    recentlyClosedTabs(s, "default").map((c) => c.id),
    ["new", "old"],
  );
});

test("tabs closed from a private window never reach the History page", () => {
  const s = {
    closedTabs: [entry("secret", "incognito:w@default", "secret", 100)],
  };
  assert.deepEqual(recentlyClosedTabs(s, "default"), []);
});

test("the list stops at ten, and an empty profile gets an empty list", () => {
  const s = {
    closedTabs: Array.from({ length: 12 }, (_, i) => entry(`c${i}`, "default", `t${i}`, i)),
  };
  assert.equal(recentlyClosedTabs(s, "default").length, MAX_RECENTLY_CLOSED);
  assert.equal(recentlyClosedTabs(s, "default")[0]?.id, "c11");
  assert.deepEqual(recentlyClosedTabs({ closedTabs: [] }, "default"), []);
});
