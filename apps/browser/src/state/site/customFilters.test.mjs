import { test } from "node:test";
import assert from "node:assert/strict";
import { requireNativeModule } from "expo-modules-core";

import { customFiltersText, normalizeCustomRule } from "./customFilters.ts";
import { pushCustomBlockRules } from "./contentBlocking.ts";

test("a bare domain becomes a network block for the domain and its subdomains", () => {
  assert.equal(normalizeCustomRule("example.com"), "||example.com^");
  assert.equal(normalizeCustomRule("ads.example.com"), "||ads.example.com^");
  assert.equal(normalizeCustomRule("*.example.com"), "||example.com^");
  assert.equal(normalizeCustomRule("  EXAMPLE.COM  "), "||example.com^");
});

test("a filter in uBlock syntax and a URL pattern pass through unchanged", () => {
  assert.equal(normalizeCustomRule("||example.com^"), "||example.com^");
  assert.equal(normalizeCustomRule("@@||example.com^"), "@@||example.com^");
  assert.equal(normalizeCustomRule("||example.com^$third-party"), "||example.com^$third-party");
  assert.equal(normalizeCustomRule("||example.com^$domain=other.com"), "||example.com^$domain=other.com");
  assert.equal(normalizeCustomRule("*://*.example.com/*"), "*://*.example.com/*");
  assert.equal(normalizeCustomRule("https://ads.example.com/*"), "https://ads.example.com/*");
});

test("anything that is not a domain or a URL pattern is rejected", () => {
  assert.equal(normalizeCustomRule(""), null);
  assert.equal(normalizeCustomRule("   "), null);
  assert.equal(normalizeCustomRule("localhost"), null);
  assert.equal(normalizeCustomRule("example"), null);
  assert.equal(normalizeCustomRule("exa mple.com"), null);
  assert.equal(normalizeCustomRule("example.com##.ad"), null);
  assert.equal(normalizeCustomRule("not a rule"), null);
  assert.equal(normalizeCustomRule("http://"), null);
});

test("rules join into the user-filters text uBlock Origin reads", () => {
  assert.equal(customFiltersText([]), "");
  assert.equal(customFiltersText(["||a.com^", "||b.com^"]), "||a.com^\n||b.com^");
});

const native = requireNativeModule("UniVerseContentBlocker");
const calls = [];
const call = native.call;
native.call = (verb, profile, json) => {
  calls.push([verb, JSON.parse(json)]);
  return call(verb, profile, json);
};

test("pushing rules sends the joined filter text to the content blocker", async () => {
  calls.length = 0;
  await pushCustomBlockRules(["||a.com^", "||b.com^"]);
  assert.deepEqual(calls, [["setUserFilters", { content: "||a.com^\n||b.com^" }]]);
  calls.length = 0;
  await pushCustomBlockRules([]);
  assert.deepEqual(calls, [["setUserFilters", { content: "" }]]);
});

test("a failing push is noted instead of throwing", async () => {
  native.call = () => Promise.reject(new Error("the blocker is not answering"));
  await pushCustomBlockRules(["||a.com^"]);
  native.call = call;
});
