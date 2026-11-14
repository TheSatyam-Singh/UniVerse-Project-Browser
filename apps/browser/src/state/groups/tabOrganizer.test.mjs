import assert from "node:assert/strict";
import { test } from "node:test";
const { useBrowser } = await import("../browser/store.ts");
const { organizerInputs } = await import("./tabOrganizer.ts");

const S = () => useBrowser.getState();

function start() {
  S().hydrate({});
  const w = S().createWindow({ url: "https://home.example/" });
  return w;
}

function addTab(w, url, title) {
  const id = S().newTab(w, { url });
  S().updateTab(id, { title });
  return id;
}

test("organizer collects only loose tabs and skips tabs already in a group", () => {
  const w = start();
  const a = addTab(w, "https://www.kingarthurbaking.com/starter", "Sourdough starter guide");
  const b = addTab(w, "https://www.kingarthurbaking.com/recipe", "Sourdough bread recipe");
  const c = addTab(w, "https://mail.google.com/inbox", "Inbox - Mail");
  const grouped = S().createGroup([c], { name: "Mail" });
  assert.ok(grouped);
  const inputs = organizerInputs(S(), w);
  assert.deepEqual(
    inputs.map((i) => i.id),
    [a, b],
  );
  assert.equal(inputs[0].title, "Sourdough starter guide");
});

test("organizeTabs groups same-domain tabs by the rules fallback and can undo", async () => {
  const w = start();
  const a = addTab(w, "https://www.kingarthurbaking.com/starter", "Sourdough starter guide");
  const b = addTab(w, "https://www.kingarthurbaking.com/recipe", "Sourdough bread recipe");
  const c = addTab(w, "https://mail.google.com/inbox", "Inbox - Mail");
  await S().organizeTabs(w);
  assert.equal(S().organizerError, null);
  assert.equal(S().canUndoOrganizer, true);
  assert.match(S().lastOrganizeSummary, /1 groups/);
  const groups = Object.values(S().groups).filter((g) => g.windowId === w);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "Sourdough");
  assert.deepEqual([...groups[0].tabIds].sort(), [a, b].sort());
  assert.ok(S().tabs[c]);
  S().undoLastOrganization();
  assert.equal(S().canUndoOrganizer, false);
  assert.equal(Object.values(S().groups).filter((g) => g.windowId === w).length, 0);
  assert.ok(S().tabs[a]);
  assert.ok(S().tabs[b]);
});

test("organizeTabs closes a duplicate and undo reopens it", async () => {
  const w = start();
  addTab(w, "https://www.kingarthurbaking.com/starter", "Sourdough starter guide");
  addTab(w, "https://www.kingarthurbaking.com/recipe", "Sourdough bread recipe");
  const dup = addTab(w, "https://www.kingarthurbaking.com/starter", "Sourdough starter guide copy");
  await S().organizeTabs(w);
  assert.equal(S().tabs[dup], undefined);
  assert.match(S().lastOrganizeSummary, /1 duplicates/);
  S().undoLastOrganization();
  const reopened = Object.values(S().tabs).filter((t) => t.windowId === w && t.url === "https://www.kingarthurbaking.com/starter");
  assert.equal(reopened.length, 2);
});

test("organizeTabs refuses fewer than three loose tabs", async () => {
  const w = start();
  addTab(w, "https://example.com/a", "Alpha page");
  addTab(w, "https://example.com/b", "Beta page");
  await S().organizeTabs(w);
  assert.match(S().organizerError, /at least 3 unfiled tabs/);
  assert.equal(S().canUndoOrganizer, false);
});

test("organizeTabs shortens a long tab title", async () => {
  const w = start();
  addTab(w, "https://www.kingarthurbaking.com/starter", "Sourdough starter guide");
  addTab(w, "https://www.kingarthurbaking.com/recipe", "Sourdough bread recipe");
  const long = addTab(w, "https://www.bbc.com/news", "BBC News - Breaking news, video and headlines from around the world");
  await S().organizeTabs(w);
  const renamed = S().tabs[long].customTitle;
  assert.ok(renamed);
  assert.equal(renamed.length <= 24, true);
});
