import assert from "node:assert/strict";
import { test } from "node:test";

const imports = [];
const storeKeys = [];
const webKitCalls = {
  endPrivateSession: () => null,
  cookieStoreKey: ({ profile }) => (storeKeys.push(profile), profile),
  importCookies: ({ profile, storeKey, cookies }) => (imports.push({ profile, key: storeKey, cookies }), cookies.length),
};
globalThis.acTestNativeModules = {
  UniVerseWebKit: {
    addListener: () => ({ remove() {} }),
    call: async (name, profile, json) => JSON.stringify(webKitCalls[name]({ ...JSON.parse(json), profile }) ?? null),
  },
};

const { launch } = await import("../../test-native/shell.ts");
launch.switches.webkitSignIn = true;
const { useBrowser } = await import("../browser/store.ts");
const model = await import("../browser/model.ts");
const { webviews } = await import("../../platform/webviews.ts");
const { carrySignInToWebKit, carrySignInToChromium, readSignInCookies } = await import("./engineSignIn.ts");

const S = () => useBrowser.getState();
const cookie = { name: "NetflixId", value: "v", domain: ".video.example", path: "/", expires: -1, session: true, httpOnly: true, secure: true };

function pageWithCookies() {
  let answer;
  const pending = new Promise((resolve) => (answer = resolve));
  return { handle: { pageCookies: () => pending }, answer: () => answer([cookie]) };
}

test("the default profile's cookies go to its WebKit store, whose key is the empty string", async () => {
  S().hydrate({});
  imports.length = 0;
  const w = S().createWindow({ url: "https://video.example/title/1" });
  const tabId = model.activeTabId(S(), w);
  const page = pageWithCookies();
  webviews.set(tabId, page.handle);
  const carried = carrySignInToWebKit(tabId, "https://video.example/title/1");
  page.answer();
  assert.equal(await carried, 1);
  assert.deepEqual(imports.map((i) => [i.profile, i.key, i.cookies.length]), [["", "", 1]]);
  webviews.clear();
});

test("closing the private window while the cookies are read imports nothing", async () => {
  S().hydrate({});
  imports.length = 0;
  const w = S().createWindow({ kind: "private", url: "https://video.example/title/1" });
  const tabId = model.activeTabId(S(), w);
  const page = pageWithCookies();
  webviews.set(tabId, page.handle);
  const carried = carrySignInToWebKit(tabId, "https://video.example/title/1");
  await Promise.resolve();
  S().closeWindow(w);
  page.answer();
  assert.equal(await carried, 0);
  assert.deepEqual(imports, []);
  webviews.clear();
});

test("a tab that moved to another profile while the cookies were read imports nothing", async () => {
  S().hydrate({});
  imports.length = 0;
  const w = S().createWindow({ url: "https://music.example/" });
  const tabId = model.activeTabId(S(), w);
  const page = pageWithCookies();
  webviews.set(tabId, page.handle);
  const carried = carrySignInToWebKit(tabId, "https://music.example/");
  await Promise.resolve();
  S().updateTab(tabId, { profileId: "work" });
  page.answer();
  assert.equal(await carried, 0);
  assert.deepEqual(imports, []);
  webviews.clear();
});

test("a WebKit tab's cookies are read back for the carry to Chromium", async () => {
  S().hydrate({});
  const w = S().createWindow({ url: "https://video.example/title/1" });
  const tabId = model.activeTabId(S(), w);
  S().updateTab(tabId, { engine: "webkit" });
  const page = pageWithCookies();
  webviews.set(tabId, page.handle);
  const read = readSignInCookies(tabId, "https://video.example/title/1");
  page.answer();
  assert.deepEqual(await read, [cookie]);
  webviews.clear();
});

test("the carried cookies are imported into the new Chromium tab and the page reloads", async () => {
  S().hydrate({});
  const w = S().createWindow({ url: "https://video.example/title/1" });
  const tabId = model.activeTabId(S(), w);
  S().updateTab(tabId, { engine: "webkit" });
  const webKitPage = pageWithCookies();
  webviews.set(tabId, webKitPage.handle);
  const read = readSignInCookies(tabId, "https://video.example/title/1");
  webKitPage.answer();
  const cookies = await read;
  assert.deepEqual(cookies, [cookie]);
  const oldWeb = webviews.get(tabId);
  let imported = null;
  let reloads = 0;
  const chromiumPage = {
    importCookies: (cs) => ((imported = cs), Promise.resolve(cs.length)),
    reload: () => ((reloads += 1), Promise.resolve()),
  };
  S().updateTab(tabId, { engine: "chromium" });
  webviews.set(tabId, chromiumPage);
  assert.equal(await carrySignInToChromium(tabId, cookies, oldWeb), 1);
  assert.deepEqual(imported, [cookie]);
  assert.equal(reloads, 1);
  webviews.clear();
});

test("no Chromium tab appears, so nothing is imported and nothing reloads", async () => {
  S().hydrate({});
  const w = S().createWindow({ url: "https://video.example/title/1" });
  const tabId = model.activeTabId(S(), w);
  const oldWeb = { pageCookies: () => Promise.resolve([cookie]) };
  assert.equal(await carrySignInToChromium(tabId, [cookie], oldWeb), 0);
  webviews.clear();
});
