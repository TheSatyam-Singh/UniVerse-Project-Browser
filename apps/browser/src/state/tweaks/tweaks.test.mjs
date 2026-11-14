import assert from "node:assert/strict";
import { test } from "node:test";

const stub = await import("../../test-native/index.ts");
const { useBrowser } = await import("../browser/store.ts");
const { currentTweaks, loadTweaks, resetTweaksForTests, setSponsorBlockCategory, updateTweaks, useTweaks } = await import("./tweaks.ts");
const routing = await import("./siteRouting.ts");

const freshLoad = () => {
  useTweaks.setState({ loaded: false });
  loadTweaks();
};

const resetSettings = () => useBrowser.getState().hydrate({});

test("tweaks load from the document and fall back to defaults when it is missing or bad", () => {
  stub.docs.clear();
  resetSettings();
  freshLoad();
  assert.equal(currentTweaks().sponsorBlockEnabled, false);
  assert.equal(currentTweaks().allowUniverseLinks, false);
  stub.docs.set("tweaks.json", JSON.stringify({ sponsorBlockEnabled: true, allowUniverseLinks: true }));
  freshLoad();
  assert.equal(currentTweaks().allowUniverseLinks, true);
  assert.equal(currentTweaks().sponsorBlockEnabled, false);
  stub.docs.set("tweaks.json", "not json");
  freshLoad();
  assert.equal(currentTweaks().allowUniverseLinks, false);
});

test("sponsorBlock settings live in the settings store, not tweaks.json", () => {
  stub.docs.clear();
  resetSettings();
  resetTweaksForTests();
  stub.docs.set("tweaks.json", JSON.stringify({ sponsorBlockEnabled: true, sponsorBlockCategoryOptions: { sponsor: "manual" } }));
  freshLoad();
  assert.equal(currentTweaks().sponsorBlockEnabled, false);
  assert.equal(currentTweaks().sponsorBlockCategoryOptions.sponsor, "auto");
  updateTweaks({ sponsorBlockEnabled: true });
  assert.equal(useBrowser.getState().settings.sponsorBlockEnabled, true);
  assert.equal(currentTweaks().sponsorBlockEnabled, true);
  assert.equal("sponsorBlockEnabled" in JSON.parse(stub.docs.get("tweaks.json")), false);
  setSponsorBlockCategory("sponsor", "manual");
  assert.equal(useBrowser.getState().settings.sponsorBlockCategories.sponsor, "manual");
  assert.equal(currentTweaks().sponsorBlockCategoryOptions.sponsor, "manual");
  assert.equal("sponsorBlockCategoryOptions" in JSON.parse(stub.docs.get("tweaks.json")), false);
  assert.equal(currentTweaks().sponsorBlockCategoryOptions.intro, "disabled");
});

test("site routing rules resolve, add, update, delete and drop dead targets", () => {
  stub.docs.clear();
  resetTweaksForTests();
  const rule = routing.addSiteRoutingRule("https://www.news.example/tech", "p1", "/tech");
  assert.notEqual(rule, null);
  assert.equal(rule.domain, "news.example");
  assert.equal(routing.resolveSiteRoute("https://news.example/tech/x")?.id, rule.id);
  assert.equal(routing.resolveSiteRoute("https://news.example/other"), null);
  routing.updateSiteRoutingRule({ ...rule, isEnabled: false });
  assert.equal(routing.resolveSiteRoute("https://news.example/tech/x"), null);
  routing.updateSiteRoutingRule({ ...rule, isEnabled: true });
  routing.deleteSiteRoutingRule(rule.id);
  assert.equal(routing.resolveSiteRoute("https://news.example/tech/x"), null);
  const kept = routing.addSiteRoutingRule("example.com", "p1");
  routing.addSiteRoutingRule("gone.example", "p9");
  routing.dropDeadSiteRoutingRules(new Set(["p1"]));
  assert.deepEqual(routing.siteRoutingRules().map((r) => r.id), [kept.id]);
});

test("applySiteRoute opens the URL in the rule's profile and refuses OAuth and private windows", () => {
  stub.docs.clear();
  resetTweaksForTests();
  routing.addSiteRoutingRule("news.example", "p-work");
  const opened = [];
  const browser = {
    profiles: { "p-work": {}, "p-home": {} },
    windows: { w1: { id: "w1", kind: "main", profileId: "p-home" } },
    focusedWindowId: "w1",
    newTab: (windowId, options) => void opened.push([windowId, options]),
    focus: () => {},
  };
  assert.equal(routing.applySiteRoute("https://news.example/x", browser), true);
  assert.deepEqual(opened, [["w1", { url: "https://news.example/x", profileId: "p-work" }]]);
  assert.equal(routing.applySiteRoute("https://other.example/", browser), false);
  assert.equal(routing.applySiteRoute("https://news.example/oauth2/authorize?client_id=x", browser), false);
  assert.equal(opened.length, 1);
  const privateBrowser = { ...browser, windows: { w1: { id: "w1", kind: "private", profileId: "p-home" } } };
  assert.equal(routing.applySiteRoute("https://news.example/x", privateBrowser), false);
});
