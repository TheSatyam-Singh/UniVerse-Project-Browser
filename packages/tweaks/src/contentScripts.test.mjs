import assert from "node:assert/strict";
import { test } from "node:test";
import {
  boostRunScripts,
  boostStyleScript,
  boostStyleScriptFor,
  cancelZapPickerScript,
  tweakScriptsFor,
  zapPickerScript,
} from "./contentScripts.ts";
import { defaultTweaksSettings, parseTweaksSettings, tweaksSettingsJson } from "./settings.ts";
import { newBoost } from "./boost.ts";

test("tweakScriptsFor picks the scripts for the page's host", () => {
  const settings = defaultTweaksSettings();
  settings.sponsorBlockEnabled = true;
  settings.youTube.hideShorts = true;
  assert.deepEqual(
    tweakScriptsFor("https://www.youtube.com/watch?v=x", settings).map((s) => s.id),
    ["universe-sponsorblock", "universe-youtube-tweaks"],
  );
  settings.facebook.hideReels = true;
  assert.deepEqual(
    tweakScriptsFor("https://www.facebook.com/", settings).map((s) => s.id),
    ["universe-facebook-tweaks"],
  );
  settings.reddit.sortHot = true;
  assert.deepEqual(
    tweakScriptsFor("https://www.reddit.com/r/a/", settings).map((s) => s.id),
    ["universe-reddit-tweaks"],
  );
  settings.mediaDownloadSites = ["instagram.com"];
  assert.deepEqual(
    tweakScriptsFor("https://www.instagram.com/p/x/", settings).map((s) => s.id),
    ["universe-social-download", "universe-social-video-source"],
  );
  assert.deepEqual(tweakScriptsFor("https://example.com/", settings), []);
  assert.deepEqual(tweakScriptsFor("not a url", settings), []);
});

test("facebook tweaks run in the page world, the rest in an isolated world", () => {
  const settings = defaultTweaksSettings();
  settings.facebook.hideReels = true;
  settings.sponsorBlockEnabled = true;
  const scripts = tweakScriptsFor("https://www.facebook.com/", settings);
  assert.equal(scripts[0].world, "page");
  const yt = tweakScriptsFor("https://www.youtube.com/", settings);
  assert.equal(yt[0].world, "isolated");
  assert.match(yt[0].sourceHash, /^[0-9a-f]{12}$/);
});

test("boost style script installs one style element and removes it for empty CSS", () => {
  const settings = defaultTweaksSettings();
  settings.boosts = [{ ...newBoost("example.com"), css: "a { color: red; }" }];
  const descriptor = boostStyleScriptFor("https://example.com/", settings);
  assert.notEqual(descriptor, null);
  assert.equal(descriptor.id, "universe-boost-style");
  assert.match(descriptor.source, /universe-boost-style/);
  new Function(boostStyleScript("a { color: red; }"));
  new Function(boostStyleScript(""));
});

test("boost scripts run only for enabled scripts on matching pages", () => {
  const settings = defaultTweaksSettings();
  settings.boosts = [
    { ...newBoost("example.com", "b1"), script: "doThing()", scriptEnabled: true },
    { ...newBoost("example.com", "b2"), script: "doOther()", scriptEnabled: false },
    { ...newBoost("other.example", "b3"), script: "doThird()", scriptEnabled: true },
  ];
  const runs = boostRunScripts("https://example.com/", settings);
  assert.deepEqual(runs.map((r) => r.boostId), ["b1"]);
  assert.match(runs[0].script, /doThing\(\)/);
  assert.match(runs[0].script, /try \{/);
});

test("zap picker script parses and cancels through the shared global", () => {
  new Function(zapPickerScript);
  assert.equal(cancelZapPickerScript, "window.__universeZapCancel&&window.__universeZapCancel()");
});

test("tweaks settings round-trip and fall back to defaults field by field", () => {
  const settings = defaultTweaksSettings();
  settings.sponsorBlockEnabled = true;
  settings.sponsorBlockCategoryOptions.sponsor = "manual";
  settings.siteRoutingRules = [{ id: "r1", domain: "example.com", targetProfileId: "p1", isEnabled: true }];
  settings.allowUniverseLinks = true;
  const parsed = parseTweaksSettings(tweaksSettingsJson(settings));
  assert.equal(parsed.sponsorBlockEnabled, true);
  assert.equal(parsed.sponsorBlockCategoryOptions.sponsor, "manual");
  assert.equal(parsed.siteRoutingRules.length, 1);
  assert.equal(parsed.allowUniverseLinks, true);
  assert.deepEqual(parseTweaksSettings("garbage"), defaultTweaksSettings());
  assert.deepEqual(parseTweaksSettings(null), defaultTweaksSettings());
  const partial = parseTweaksSettings(JSON.stringify({ sponsorBlockEnabled: true, boosts: [{ host: "com" }, { host: "example.com" }] }));
  assert.equal(partial.sponsorBlockEnabled, true);
  assert.equal(partial.boosts.length, 1);
  assert.equal(partial.boosts[0].host, "example.com");
  assert.equal(partial.allowUniverseLinks, false);
});
