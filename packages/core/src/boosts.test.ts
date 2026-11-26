import assert from "node:assert/strict";
import { test } from "node:test";
import { boostMatchesHost, boostsForHost, boostShareText, isBoostList, normalizeBoostHost, parseBoostShare, type Boost } from "./boosts.ts";

const boost = (host: string, enabled = true): Boost => ({ id: "b1", name: "Dark", host, css: "body { background: black; }", enabled });

test("boost host matching covers subdomains", () => {
  assert.equal(boostMatchesHost(boost("youtube.com"), "www.youtube.com"), true);
  assert.equal(boostMatchesHost(boost("youtube.com"), "youtube.com"), true);
  assert.equal(boostMatchesHost(boost("youtube.com"), "music.youtube.com"), true);
  assert.equal(boostMatchesHost(boost("youtube.com"), "notyoutube.com"), false);
  assert.equal(boostMatchesHost(boost("www.github.com"), "github.com"), true);
  assert.equal(boostMatchesHost(boost(""), "github.com"), false);
});

test("boostsForHost filters disabled and non-matching boosts", () => {
  const list = [boost("github.com"), boost("youtube.com", false), boost("github.com")];
  assert.equal(boostsForHost(list, "github.com").length, 2);
  assert.equal(boostsForHost(list, "youtube.com").length, 0);
});

test("boost share round-trips through JSON", () => {
  const text = boostShareText(boost("github.com"));
  const parsed = parseBoostShare(text);
  assert.equal(parsed?.length, 1);
  assert.equal(parsed?.[0]?.name, "Dark");
  assert.equal(parsed?.[0]?.host, "github.com");
  assert.equal(parsed?.[0]?.css, "body { background: black; }");
  assert.equal(parsed?.[0]?.enabled, true);
});

test("boost share rejects bad input", () => {
  assert.equal(parseBoostShare("not json"), null);
  assert.equal(parseBoostShare(JSON.stringify({ name: "x" })), null);
  assert.equal(parseBoostShare(JSON.stringify([])), null);
  assert.equal(parseBoostShare(JSON.stringify([{ name: "x", host: "a.com", css: "b {}" }, { name: "y" }])), null);
});

test("boost list validation", () => {
  assert.equal(isBoostList([boost("a.com")]), true);
  assert.equal(isBoostList([{ id: "x" }]), false);
  assert.equal(isBoostList("nope"), false);
  assert.equal(normalizeBoostHost("  WWW.Example.COM "), "example.com");
});
