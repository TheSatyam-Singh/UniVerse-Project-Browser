import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanUrlWithRemoveParam, parseRemoveParamRules, stripTrackingParams } from "./removeParam.ts";

const rules = (lines: string[]) => parseRemoveParamRules(lines);

test("a host rule strips only its named parameter on that host and its subdomains", () => {
  const r = rules(["||example.com^$removeparam=utm_source"]);
  assert.equal(r.ruleCount, 1);
  assert.equal(stripTrackingParams("https://example.com/p?utm_source=x&keep=1", r), "https://example.com/p?keep=1");
  assert.equal(stripTrackingParams("https://sub.example.com/p?utm_source=x&keep=1", r), "https://sub.example.com/p?keep=1");
  assert.equal(stripTrackingParams("https://other.com/p?utm_source=x&keep=1", r), null);
});

test("a generic rule strips its parameter everywhere and leaves other parameters alone", () => {
  const r = rules(["$removeparam=fbclid"]);
  assert.equal(stripTrackingParams("https://anywhere.test/a?fbclid=1&x=2", r), "https://anywhere.test/a?x=2");
  assert.equal(stripTrackingParams("https://anywhere.test/a?x=2", r), null);
});

test("a regex rule strips matching names and a host rule with no name strips every parameter", () => {
  const r = rules(["$removeparam=/^utm_/", "||shop.test^$removeparam"]);
  assert.equal(stripTrackingParams("https://a.test/?utm_campaign=c&utm_x=1&keep=2", r), "https://a.test/?keep=2");
  assert.equal(stripTrackingParams("https://shop.test/item?a=1&b=2", r), "https://shop.test/item");
});

test("an exception keeps its parameter and a bare all-windows removeparam is refused", () => {
  const r = rules(["||example.com^$removeparam=utm_source", "@@||example.com^$removeparam=utm_source"]);
  assert.equal(stripTrackingParams("https://example.com/?utm_source=x", r), null);
  const bare = rules(["$removeparam"]);
  assert.equal(bare.ruleCount, 0);
  assert.equal(stripTrackingParams("https://example.com/?a=1", bare), null);
});

test("domain restrictions scope a rule and inverted removeparam values are skipped", () => {
  const r = rules(["$removeparam=ref,domain=example.com|~sub.example.com", "$removeparam=~bad"]);
  assert.equal(r.ruleCount, 1);
  assert.equal(stripTrackingParams("https://example.com/?ref=1&k=2", r), "https://example.com/?k=2");
  assert.equal(stripTrackingParams("https://sub.example.com/?ref=1&k=2", r), null);
  assert.equal(stripTrackingParams("https://other.com/?ref=1&k=2", r), null);
});

test("a path hint only matches urls containing it and non-navigation options reject the rule", () => {
  const r = rules(["||example.com/path$removeparam=utm_source", "||example.com^$removeparam=x,script"]);
  assert.equal(r.ruleCount, 1);
  assert.equal(stripTrackingParams("https://example.com/other?utm_source=1", r), null);
  assert.equal(stripTrackingParams("https://example.com/path/deep?utm_source=1&k=2", r), "https://example.com/path/deep?k=2");
});

test("cleanUrlWithRemoveParam layers list rules under the built-in cleaner", () => {
  const r = rules(["$removeparam=custom_track"]);
  assert.equal(cleanUrlWithRemoveParam("https://example.com/?custom_track=1&gclid=2&keep=3", r), "https://example.com/?keep=3");
  assert.equal(cleanUrlWithRemoveParam("https://example.com/?keep=3", r), "https://example.com/?keep=3");
});
