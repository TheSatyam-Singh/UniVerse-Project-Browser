import assert from "node:assert/strict";
import { test } from "node:test";
const { useBrowser } = await import("../browser/store.ts");
const { startWindowCloseGuard } = await import("./windowClose.ts");
const { openLastWindowOrNew } = await import("./lastWindow.ts");
const { normalizeStartupPages, startupPageUrls, openStartupWindow } = await import("./startupPages.ts");
const { loadSession, flushPersistence, startPersistence } = await import("../session/persist.ts");
const { takeStartupPagesCounts } = await import("../telemetry/startupPages.ts");
const { shellNativeModules, windows } = await import("../../test-native/shell.ts");

const S = () => useBrowser.getState();
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const asked = [];
shellNativeModules.UniVerseDialogs.confirm = (options) => {
  asked.push(options);
  return Promise.resolve({ confirmed: true, suppressed: false });
};
startPersistence();
startWindowCloseGuard();

async function closeByUser(id) {
  asked.length = 0;
  windows.emit({ type: "closeRequest", id });
  await tick();
  await tick();
  return asked.map((d) => d.title);
}

const urlOf = (id) => S().tabs[id].url;
const listUrls = (w) => S().windows[w].tabIds.filter((id) => !S().tabs[id].pin).map(urlOf);
const shownUrl = (w) => urlOf(S().windows[w].activeTabIds[S().windows[w].profileId]);
const onlyWindow = () => {
  assert.equal(S().windowOrder.length, 1, "one window");
  return S().windowOrder[0];
};

function arcWindow() {
  S().hydrate({});
  const w = S().createWindow({ url: "https://mail.com" });
  const [mail] = S().windows[w].tabIds;
  const cal = S().newTab(w, { url: "https://cal.com" });
  S().pinTabs([mail, cal], true);
  const a = S().newTab(w, { url: "https://a.com" });
  const b = S().newTab(w, { url: "https://b.com" });
  S().activate(a);
  return { w, a, b };
}

test("only web addresses survive, bare hosts gain https, repeats collapse, and the list caps at twenty", () => {
  assert.deepEqual(normalizeStartupPages(["example.com", "http://a.com", "https://a.com/", "ftp://files.com", "not a url", "", "  https://b.com/path?q=1  ", 42, null]), [
    "https://example.com/",
    "http://a.com/",
    "https://a.com/",
    "https://b.com/path?q=1",
  ]);
  assert.deepEqual(normalizeStartupPages("https://a.com"), []);
  assert.deepEqual(normalizeStartupPages(undefined), []);
  assert.equal(normalizeStartupPages(Array.from({ length: 25 }, (_, i) => `https://p${i}.com`)).length, 20);
});

test("startup pages apply only in the specific-pages mode", () => {
  const settings = { startupMode: "customPages", startupPages: ["example.com"] };
  assert.deepEqual(startupPageUrls(settings), ["https://example.com/"]);
  assert.deepEqual(startupPageUrls({ ...settings, startupMode: "newTab" }), []);
  assert.deepEqual(startupPageUrls({ ...settings, startupMode: "lastSession" }), []);
});

test("with specific pages on, a relaunch opens those pages instead of the last session", async () => {
  const { w } = arcWindow();
  await closeByUser(w);
  S().updateSettings({ startupMode: "customPages", startupPages: ["https://mail.com", "https://cal.com", "not a url"], restoreSession: false });
  flushPersistence();
  try {
    S().hydrate(loadSession());
    assert.equal(S().windowOrder.length, 0);
    const id = openLastWindowOrNew("launch");
    assert.equal(onlyWindow(), id);
    assert.deepEqual(listUrls(id), ["https://mail.com/", "https://cal.com/"]);
    assert.equal(shownUrl(id), "https://mail.com/");
  } finally {
    S().updateSettings({ startupMode: "lastSession", startupPages: [], restoreSession: true });
  }
});

test("with a new tab on, a relaunch opens one empty tab", async () => {
  const { w } = arcWindow();
  await closeByUser(w);
  S().updateSettings({ startupMode: "newTab", restoreSession: false });
  flushPersistence();
  try {
    S().hydrate(loadSession());
    const id = openLastWindowOrNew("launch");
    assert.deepEqual(listUrls(id), [""]);
  } finally {
    S().updateSettings({ startupMode: "lastSession", restoreSession: true });
  }
});

test("with the last session on, a relaunch still restores the tabs", async () => {
  const { w } = arcWindow();
  await closeByUser(w);
  S().updateSettings({ startupMode: "lastSession", restoreSession: true });
  flushPersistence();
  S().hydrate(loadSession());
  const id = openLastWindowOrNew("launch");
  assert.deepEqual(listUrls(id), ["https://a.com", "https://b.com"]);
  assert.equal(shownUrl(id), "https://a.com");
});

test("specific pages with an empty list opens one empty tab", () => {
  S().hydrate({});
  S().updateSettings({ startupMode: "customPages", startupPages: [] });
  const id = openStartupWindow();
  assert.deepEqual(listUrls(id), [""]);
});

test("a Dock click never opens the startup pages", () => {
  S().hydrate({});
  S().updateSettings({ startupMode: "customPages", startupPages: ["https://mail.com"] });
  const id = openLastWindowOrNew("dock");
  assert.deepEqual(listUrls(id), [""]);
});

test("opening the startup pages counts them, and the count resets when taken", async () => {
  takeStartupPagesCounts();
  const { w } = arcWindow();
  await closeByUser(w);
  S().updateSettings({ startupMode: "customPages", startupPages: ["https://a.com", "https://b.com", "https://c.com"], restoreSession: false });
  flushPersistence();
  try {
    S().hydrate(loadSession());
    openLastWindowOrNew("launch");
    assert.deepEqual(takeStartupPagesCounts(), { startup_pages_opened: 3 });
    assert.deepEqual(takeStartupPagesCounts(), { startup_pages_opened: 0 });
  } finally {
    S().updateSettings({ startupMode: "lastSession", startupPages: [], restoreSession: true });
  }
});
