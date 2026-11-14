import assert from "node:assert/strict";
import { test } from "node:test";
import {
  arcRouteToSiteRule,
  bestSiteRule,
  dropDeadRoutingRules,
  newSiteRoutingRule,
  normalizeSiteDomain,
  siteRuleMatches,
} from "./siteRouting.ts";

const rule = (over = {}) => ({
  id: "r1",
  domain: "example.com",
  targetProfileId: "p1",
  isEnabled: true,
  ...over,
});

test("normalize strips scheme, www and path", () => {
  assert.equal(normalizeSiteDomain("https://www.Example.com/x"), "example.com");
  assert.equal(normalizeSiteDomain("  example.com/ "), "example.com");
});

test("a rule covers its domain and subdomains, and its path prefix", () => {
  assert.equal(siteRuleMatches(rule(), "https://example.com/a"), true);
  assert.equal(siteRuleMatches(rule(), "https://sub.example.com/a"), true);
  assert.equal(siteRuleMatches(rule(), "https://notexample.com/a"), false);
  assert.equal(siteRuleMatches(rule({ pathPrefix: "/docs" }), "https://example.com/docs/x"), true);
  assert.equal(siteRuleMatches(rule({ pathPrefix: "/docs" }), "https://example.com/other"), false);
  assert.equal(siteRuleMatches(rule({ isEnabled: false }), "https://example.com/"), false);
});

test("best rule is the longest domain, then the longest path prefix", () => {
  const rules = [
    rule({ id: "a", domain: "example.com", targetProfileId: "p1" }),
    rule({ id: "b", domain: "sub.example.com", targetProfileId: "p2" }),
    rule({ id: "c", domain: "sub.example.com", pathPrefix: "/docs", targetProfileId: "p3" }),
  ];
  assert.equal(bestSiteRule("https://sub.example.com/docs/x", rules)?.id, "c");
  assert.equal(bestSiteRule("https://sub.example.com/other", rules)?.id, "b");
  assert.equal(bestSiteRule("https://example.com/", rules)?.id, "a");
  assert.equal(bestSiteRule("https://other.example/", rules), null);
});

test("dropDeadRoutingRules moves a rule to its heir and drops rules pointing nowhere", () => {
  const live = new Set(["p2", "p3"]);
  const rules = [
    rule({ id: "a", targetProfileId: "p1", legacyProfileId: "p2" }),
    rule({ id: "b", targetProfileId: "p9" }),
    rule({ id: "c", targetProfileId: "p3" }),
  ];
  const { rules: kept, changed } = dropDeadRoutingRules(rules, live);
  assert.equal(changed, true);
  assert.deepEqual(kept.map((r) => r.id), ["a", "c"]);
  assert.equal(kept[0].targetProfileId, "p2");
  assert.equal(kept[0].legacyProfileId, undefined);
});

test("arc routes become site rules only when the pattern is a host with an optional path and the space came in", () => {
  const spaces = new Map([["s1", "p1"]]);
  let n = 0;
  const makeId = () => `id${++n}`;
  const existing = [];
  const ok = arcRouteToSiteRule("https://news.example/tech", "s1", spaces, existing, makeId);
  assert.equal("rule" in ok, true);
  if ("rule" in ok) {
    assert.equal(ok.rule.domain, "news.example");
    assert.equal(ok.rule.pathPrefix, "/tech");
    existing.push(ok.rule);
  }
  assert.deepEqual(arcRouteToSiteRule("https://news.example/tech", "s1", spaces, existing, makeId), { skipped: true });
  assert.deepEqual(arcRouteToSiteRule("example.com/*/x", "s1", spaces, existing, makeId), { skipped: true });
  assert.deepEqual(arcRouteToSiteRule("news.example", "missing-space", spaces, existing, makeId), { skipped: true });
  const bare = arcRouteToSiteRule("news.example", "s1", spaces, existing, makeId);
  assert.equal("rule" in bare, true);
  if ("rule" in bare) assert.equal(bare.rule.pathPrefix, undefined);
});

test("newSiteRoutingRule refuses an empty domain or target", () => {
  assert.equal(newSiteRoutingRule("", "p1"), null);
  assert.equal(newSiteRoutingRule("example.com", ""), null);
  assert.notEqual(newSiteRoutingRule("example.com", "p1"), null);
});
