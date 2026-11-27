import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

globalThis.__DEV__ = false;

const stubs = {
  "../pages/urls": "export const isInternalTab = (t) => !/^https?:/.test(t.url ?? '');",
};
registerHooks({
  resolve(specifier, context, next) {
    if (!/\/state\/tabs\/tabHibernation\.ts$/.test(context.parentURL ?? "") || !(specifier in stubs)) return next(specifier, context);
    return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
  },
});
const { useBrowser } = await import("../browser/store.ts");
const { webviews } = await import("../../platform/webviews.ts");
const { useLifecycle } = await import("./sleepingTabs.ts");
const { hibernatable, hibernationChoices, isKeepActiveUrl, sweepHibernation } = await import("./tabHibernation.ts");

const S = () => useBrowser.getState();
const MINUTE = 60_000;
const NOW = Date.now();

const setup = () => {
  S().hydrate({});
  useLifecycle.setState({ discarded: {}, batterySaver: false });
  webviews.clear();
  const w = S().createWindow({ url: "https://a.com/" });
  const a = S().windows[w].tabIds[0];
  return { w, a };
};

const age = (id, ms) => useBrowser.setState((s) => ({ tabs: { ...s.tabs, [id]: { ...s.tabs[id], lastActiveAt: NOW - ms } } }));
const fake = (outcome = "discarded", calls = []) => ({
  discard: async (options) => {
    calls.push(options);
    return outcome;
  },
});

test("an idle tab hibernates, the active and recent ones do not", async () => {
  const { w, a } = setup();
  const b = S().newTab(w, { url: "https://b.com/", background: true });
  const c = S().newTab(w, { url: "https://c.com/", background: true });
  age(a, 31 * MINUTE);
  age(b, 31 * MINUTE);
  age(c, 5 * MINUTE);
  const calls = [];
  webviews.set(a, fake("discarded", calls));
  webviews.set(b, fake("discarded", calls));
  webviews.set(c, fake("discarded", calls));
  assert.equal(hibernatable(S(), b, NOW), true, "idle");
  assert.equal(hibernatable(S(), a, NOW), false, "active");
  assert.equal(hibernatable(S(), c, NOW), false, "recent");
  assert.deepEqual(await sweepHibernation(NOW), [b]);
  assert.deepEqual(calls, [{ unload: true }], "discards to unload the page");
});

test("playing, loading, keep-active, internal and private tabs never hibernate", async () => {
  const { w, a } = setup();
  const cases = [];
  const playing = S().newTab(w, { url: "https://play.example/", background: true });
  const loading = S().newTab(w, { url: "https://load.example/", background: true });
  const kept = S().newTab(w, { url: "https://www.youtube.com/watch?v=1", background: true });
  const internal = S().newTab(w, { url: "https://internal.example/", background: true });
  const priv = S().newTab(w, { url: "https://private.example/", background: true });
  for (const id of [playing, loading, kept, internal, priv]) age(id, 31 * MINUTE);
  S().updateLive(playing, { playingAudio: true });
  S().updateLive(loading, { isLoading: true });
  S().updateSettings({ keepActiveSites: ["youtube.com"] });
  useBrowser.setState((s) => ({
    tabs: {
      ...s.tabs,
      [internal]: { ...s.tabs[internal], url: "universe://history" },
      [priv]: { ...s.tabs[priv], profileId: "incognito:default" },
    },
  }));
  for (const id of [playing, loading, kept, internal, priv]) {
    webviews.set(id, fake());
    cases.push([id, hibernatable(S(), id, NOW)]);
  }
  assert.deepEqual(
    cases.map(([id, value]) => [S().tabs[id].url, value]),
    [
      ["https://play.example/", false],
      ["https://load.example/", false],
      ["https://www.youtube.com/watch?v=1", false],
      ["universe://history", false],
      ["https://private.example/", false],
    ],
  );
  assert.deepEqual(await sweepHibernation(NOW), [], "none hibernated");
  void a;
});

test("memory saver off or never: nothing hibernates", async () => {
  const { w } = setup();
  const b = S().newTab(w, { url: "https://b.com/", background: true });
  age(b, 31 * MINUTE);
  webviews.set(b, fake());
  S().updateSettings({ memorySaver: false });
  assert.equal(hibernatable(S(), b, NOW), false, "saver off");
  assert.deepEqual(await sweepHibernation(NOW), []);
  S().updateSettings({ memorySaver: true, memorySaverIdleMinutes: null });
  assert.equal(hibernatable(S(), b, NOW), false, "never");
  assert.deepEqual(await sweepHibernation(NOW), []);
});

test("a sleeping tab is not discarded again, and a refused discard is not counted", async () => {
  const { w } = setup();
  const b = S().newTab(w, { url: "https://b.com/", background: true });
  const c = S().newTab(w, { url: "https://c.com/", background: true });
  age(b, 31 * MINUTE);
  age(c, 31 * MINUTE);
  const calls = [];
  webviews.set(b, fake("discarded", calls));
  webviews.set(c, fake("refused", calls));
  useLifecycle.setState((l) => ({ discarded: { ...l.discarded, [b]: true } }));
  assert.equal(hibernatable(S(), b, NOW), false, "already asleep");
  assert.deepEqual(await sweepHibernation(NOW), [], "refused is not counted");
  assert.equal(calls.length, 1, "only the awake tab was asked");
});

test("a tab with no loaded page has nothing to free", async () => {
  const { w } = setup();
  const b = S().newTab(w, { url: "https://b.com/", background: true });
  age(b, 31 * MINUTE);
  assert.equal(hibernatable(S(), b, NOW), false, "no web view handle");
  assert.deepEqual(await sweepHibernation(NOW), []);
});

test("keep-active matching is by site, not by substring", () => {
  assert.equal(isKeepActiveUrl("https://www.youtube.com/watch?v=1", ["youtube.com"]), true);
  assert.equal(isKeepActiveUrl("https://sub.example.com/", ["example.com"]), true);
  assert.equal(isKeepActiveUrl("https://example.com/", ["https://example.com/docs"]), true);
  assert.equal(isKeepActiveUrl("https://example.com/", ["other.com"]), false);
  assert.equal(isKeepActiveUrl("https://notexample.com/", ["example.com"]), false);
  assert.equal(isKeepActiveUrl("https://example.com.evil.com/", ["example.com"]), false);
  assert.equal(isKeepActiveUrl("universe://history", ["example.com"]), false);
});

test("hibernation choices list the presets, the current value and never", () => {
  assert.deepEqual(
    hibernationChoices(30).map((c) => c.value),
    ["5", "15", "30", "60", "120", "never"],
  );
  assert.deepEqual(
    hibernationChoices(30).map((c) => c.title),
    ["5 minutes", "15 minutes", "30 minutes", "1 hour", "2 hours", "Never"],
  );
  assert.deepEqual(
    hibernationChoices(45).map((c) => c.value),
    ["5", "15", "30", "45", "60", "120", "never"],
  );
  assert.deepEqual(
    hibernationChoices(null).map((c) => c.value),
    ["5", "15", "30", "60", "120", "never"],
  );
});
