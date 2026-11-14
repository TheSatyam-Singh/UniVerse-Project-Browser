import assert from "node:assert/strict";
import { test } from "node:test";
import {
  boostCssFor,
  compiledBoostCss,
  exportBoosts,
  isAllowedZap,
  isHexColor,
  matchingBoosts,
  newBoost,
  normalizeBoostHost,
  parseBoostBundle,
  removingBaitRules,
  stripRemoteCss,
  zapFilterLines,
} from "./boost.ts";

test("normalizeBoostHost strips a URL down to a bare host", () => {
  assert.equal(normalizeBoostHost("https://www.Example.com/x"), "example.com");
  assert.equal(normalizeBoostHost("com"), "");
  assert.equal(normalizeBoostHost("*.example.com"), "");
  assert.equal(normalizeBoostHost("exa mple.com"), "");
});

test("a Boost matches its host and subdomains, http(s) only", () => {
  const boost = { ...newBoost("example.com"), isEnabled: true };
  assert.equal(matchingBoosts("https://example.com/", [boost]).length, 1);
  assert.equal(matchingBoosts("https://sub.example.com/x", [boost]).length, 1);
  assert.equal(matchingBoosts("https://notexample.com/", [boost]).length, 0);
  assert.equal(matchingBoosts("file:///etc/passwd", [boost]).length, 0);
  const exact = { ...newBoost("example.com", "b2"), includeSubdomains: false };
  assert.equal(matchingBoosts("https://sub.example.com/", [exact]).length, 0);
});

test("compiled CSS puts visual controls first and the user's CSS last", () => {
  const boost = {
    ...newBoost("example.com"),
    brightness: 0.8,
    darkPage: true,
    tint: "#336699",
    tintStrength: 0.4,
    fontFamily: "Georgia, serif",
    fontScale: 1.2,
    textCase: "uppercase",
    zaps: [".ad-banner", "#player-ads"],
    css: "body { color: red; }",
  };
  const css = compiledBoostCss(boost);
  assert.match(css, /backdrop-filter: invert\(1\) hue-rotate\(180deg\) brightness\(0\.80\)/);
  assert.match(css, /background: #336699; mix-blend-mode: color; opacity: 0\.40/);
  assert.match(css, /font-family: Georgia, serif/);
  assert.match(css, /font-size: 120%/);
  assert.match(css, /text-transform: uppercase/);
  assert.match(css, /\.ad-banner \{ display: none !important; \}/);
  assert.doesNotMatch(css, /player-ads/);
  assert.ok(css.indexOf("body { color: red; }") > css.indexOf("backdrop-filter"));
});

test("zap rules never hide YouTube's ad-block bait", () => {
  assert.equal(isAllowedZap(".ad-banner"), true);
  assert.equal(isAllowedZap("#player-ads"), false);
  assert.equal(isAllowedZap(".x { display: none }"), false);
  assert.equal(isAllowedZap("example.com##.x"), false);
  assert.equal(removingBaitRules("a { color: red; } #player-ads { display: none; } b { color: blue; }"), "a { color: red; } b { color: blue; }");
});

test("zap filter lines compile to host##selector for the content blocker", () => {
  const boosts = [
    { ...newBoost("example.com"), zaps: [".a", "#player-ads"] },
    { ...newBoost("other.example", "b2"), isEnabled: false, zaps: [".b"] },
  ];
  assert.deepEqual(zapFilterLines(boosts), ["example.com##.a"]);
});

test("hex colors are #RRGGBB only", () => {
  assert.equal(isHexColor("#336699"), true);
  assert.equal(isHexColor("#33669"), false);
  assert.equal(isHexColor("red"), false);
});

test("imported CSS cannot reach the network and scripts arrive disabled", () => {
  const exported = exportBoosts([{ ...newBoost("example.com"), css: "@import url(evil.example); a { background: url(x.png); }", script: "alert(1)", scriptEnabled: true }]);
  const parsed = parseBoostBundle(exported);
  assert.equal("boosts" in parsed, true);
  if (!("boosts" in parsed)) return;
  assert.equal(parsed.boosts.length, 1);
  assert.equal(parsed.boosts[0].scriptEnabled, false);
  assert.equal(parsed.boosts[0].script, "alert(1)");
  assert.doesNotMatch(parsed.boosts[0].css, /@import|url\(/);
});

test("a bundle with a bad host or a newer schema is refused", () => {
  assert.deepEqual(parseBoostBundle(JSON.stringify({ schema: 1, boosts: [{ host: "com" }] })), { message: "A Boost has an invalid site." });
  assert.deepEqual(parseBoostBundle(JSON.stringify({ schema: 99, boosts: [] })), {
    message: "This file was made by a newer version of UniVerse Project Browser.",
  });
  assert.deepEqual(parseBoostBundle("not json"), { message: "This is not a UniVerse Boost file." });
});

test("remote CSS stripping removes imports, urls and backslashes", () => {
  assert.equal(stripRemoteCss("@import 'x'; a { color: red; }"), " a { color: red; }");
  assert.equal(stripRemoteCss("a { background: url(x.png); }"), "a { background: ; }");
});

test("boostCssFor joins every matching Boost in list order", () => {
  const boosts = [
    { ...newBoost("example.com", "b1"), css: "a { color: red; }" },
    { ...newBoost("example.com", "b2"), css: "b { color: blue; }" },
  ];
  const css = boostCssFor("https://example.com/", boosts);
  assert.ok(css.indexOf("color: red") < css.indexOf("color: blue"));
});
