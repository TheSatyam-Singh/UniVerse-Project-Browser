import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handleUniverseLink,
  isSamePage,
  isUniverseLink,
  matchUniverseSpace,
  parseUniverseLink,
  universeSearchUrl,
  webUrl,
} from "./universeLinks.ts";

const spaces = [
  { id: "11111111-2222-3333-4444-555555555555", name: "Work" },
  { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", name: "Home" },
];

test("universe links parse open, search and space commands", () => {
  assert.deepEqual(parseUniverseLink("universe://open?url=https%3A%2F%2Fexample.com%2Fnews&space=Work&reuse=1"), {
    action: { kind: "open", url: "https://example.com/news", reuse: true },
    space: "Work",
    ignored: [],
  });
  assert.deepEqual(parseUniverseLink("universe://search?q=hello+world"), {
    action: { kind: "search", query: "hello+world" },
    ignored: [],
  });
  assert.deepEqual(parseUniverseLink("universe://space?name=home"), {
    action: { kind: "switchSpace" },
    space: "home",
    ignored: [],
  });
  assert.deepEqual(parseUniverseLink("universe://open?url=https%3A%2F%2Fexample.com&extra=1&other=2"), {
    action: { kind: "open", url: "https://example.com/", reuse: false },
    ignored: ["extra", "other"],
  });
});

test("universe links reject bad schemes, hosts and urls", () => {
  assert.equal(parseUniverseLink("https://example.com"), null);
  assert.equal(parseUniverseLink("universe://delete?url=https%3A%2F%2Fexample.com"), null);
  assert.equal(parseUniverseLink("universe://open?url=ftp%3A%2F%2Fexample.com"), null);
  assert.equal(parseUniverseLink("universe://open"), null);
  assert.equal(parseUniverseLink("universe://search"), null);
  assert.equal(parseUniverseLink("universe://space"), null);
  assert.equal(parseUniverseLink("universe://open?url=https%3A%2F%2Fexample.com&space="), null);
  assert.equal(parseUniverseLink("universe://open?url=https%3A%2F%2Fexample.com&space=%20"), null);
  assert.equal(parseUniverseLink("not a url"), null);
});

test("first query value wins and plus stays a plus", () => {
  const parsed = parseUniverseLink("universe://search?q=first&q=second");
  assert.equal(parsed?.action.kind === "search" ? parsed.action.query : null, "first");
});

test("web urls need http(s) and a host", () => {
  assert.equal(webUrl("https://example.com/path"), "https://example.com/path");
  assert.equal(webUrl("file:///tmp/x"), null);
  assert.equal(webUrl("https://"), null);
  assert.equal(webUrl("example.com"), null);
});

test("search urls substitute the encoded query into the template", () => {
  assert.equal(universeSearchUrl("a & b", "https://search.example/?q=%@"), "https://search.example/?q=a%20%26%20b");
  assert.equal(universeSearchUrl("x", "https://search.example/"), "https://search.example/");
  assert.equal(universeSearchUrl("x", "not a url"), null);
});

test("spaces match by id or case-insensitive name", () => {
  assert.equal(matchUniverseSpace("11111111-2222-3333-4444-555555555555", spaces), "11111111-2222-3333-4444-555555555555");
  assert.equal(matchUniverseSpace("work", spaces), "11111111-2222-3333-4444-555555555555");
  assert.equal(matchUniverseSpace("HOME", spaces), "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  assert.equal(matchUniverseSpace("missing", spaces), null);
});

test("same page ignores scheme and host case, fragment and trailing slash", () => {
  assert.equal(isSamePage("HTTPS://Example.com/news/", "https://example.com/news"), true);
  assert.equal(isSamePage("https://example.com/news#part", "https://example.com/news"), true);
  assert.equal(isSamePage("https://example.com/news?a=1", "https://example.com/news?a=2"), false);
  assert.equal(isSamePage("https://example.com/news", "https://other.com/news"), false);
});

function fakeContext(over = {}) {
  const calls = [];
  const ctx = {
    allowed: true,
    spaces,
    defaultProfileId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    searchTemplate: "https://search.example/?q=%@",
    tabs: [{ id: "t1", url: "https://example.com/news", profileId: "11111111-2222-3333-4444-555555555555", windowId: "w1" }],
    isPrivateWindow: () => false,
    routeProfileId: () => null,
    openUrl: (url, profileId) => calls.push(`open ${url} in ${profileId}`),
    selectTab: (tabId, windowId) => calls.push(`select ${tabId} in ${windowId}`),
    focusProfileWindow: (profileId) => calls.push(`focus ${profileId}`),
    ...over,
  };
  return { ctx, calls };
}

test("handling opens in the named space, reuses the same page, and falls back to routing", () => {
  const { ctx, calls } = fakeContext();
  assert.equal(handleUniverseLink("universe://open?url=https%3A%2F%2Fexample.com%2Fnews&space=Work&reuse=1", ctx), true);
  assert.deepEqual(calls, ["select t1 in w1"]);
  calls.length = 0;
  assert.equal(handleUniverseLink("universe://open?url=https%3A%2F%2Fexample.com%2Fother&space=Work", ctx), true);
  assert.deepEqual(calls, ["open https://example.com/other in 11111111-2222-3333-4444-555555555555"]);
  calls.length = 0;
  assert.equal(handleUniverseLink("universe://search?q=hello", ctx), true);
  assert.deepEqual(calls, ["open https://search.example/?q=hello in aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"]);
  calls.length = 0;
  assert.equal(handleUniverseLink("universe://space?name=Work", ctx), true);
  assert.deepEqual(calls, ["focus 11111111-2222-3333-4444-555555555555"]);
});

test("handling refuses when gated off, the space is unknown, or routing has no target", () => {
  const gated = fakeContext({ allowed: false });
  assert.equal(handleUniverseLink("universe://open?url=https%3A%2F%2Fexample.com", gated.ctx), false);
  assert.deepEqual(gated.calls, []);
  const { ctx, calls } = fakeContext();
  assert.equal(handleUniverseLink("universe://open?url=https%3A%2F%2Fexample.com&space=Missing", ctx), false);
  assert.deepEqual(calls, []);
  const noDefault = fakeContext({ defaultProfileId: null });
  assert.equal(handleUniverseLink("universe://open?url=https%3A%2F%2Fexample.com", noDefault.ctx), false);
  const routed = fakeContext({ routeProfileId: () => "11111111-2222-3333-4444-555555555555" });
  assert.equal(handleUniverseLink("universe://open?url=https%3A%2F%2Fexample.com", routed.ctx), true);
  assert.deepEqual(routed.calls, ["open https://example.com/ in 11111111-2222-3333-4444-555555555555"]);
});

test("isUniverseLink only matches the universe scheme", () => {
  assert.equal(isUniverseLink("universe://open?url=x"), true);
  assert.equal(isUniverseLink("UNIVERSE://open?url=x"), true);
  assert.equal(isUniverseLink("https://example.com"), false);
  assert.equal(isUniverseLink("universe:open"), false);
});
