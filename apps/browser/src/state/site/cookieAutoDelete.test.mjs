import assert from "node:assert/strict";
import { test } from "node:test";
import { openSitesOf, vacatedSites } from "./cookieAutoDelete";

const site = (host, profileId = "default", engine = "chromium") => ({ host, profileId, engine });
const mapOf = (sites) => new Map(sites.map((s) => [`${s.profileId}\n${s.host.toLowerCase()}`, s]));

test("cookieAutoDelete: a host with no open tab left is vacated", () => {
  const vacated = vacatedSites(mapOf([site("example.com"), site("other.com")]), mapOf([site("other.com")]), []);
  assert.deepEqual(vacated, [site("example.com")]);
});

test("cookieAutoDelete: a kept host is never vacated, matching case-insensitively", () => {
  const vacated = vacatedSites(mapOf([site("Example.COM")]), mapOf([]), ["example.com"]);
  assert.deepEqual(vacated, []);
});

test("cookieAutoDelete: the same host in another profile stays open", () => {
  const vacated = vacatedSites(mapOf([site("example.com", "default")]), mapOf([site("example.com", "work")]), []);
  assert.deepEqual(vacated, [site("example.com", "default")]);
});

test("cookieAutoDelete: vacating reports each host once", () => {
  const vacated = vacatedSites(mapOf([site("example.com"), site("example.com", "default", "webkit")]), mapOf([]), []);
  assert.equal(vacated.length, 1);
});

test("cookieAutoDelete: openSitesOf skips incognito tabs and non-web urls", () => {
  const tabs = {
    a: { id: "a", profileId: "default", url: "https://example.com/page", windowId: "w" },
    b: { id: "b", profileId: "incognito:1@default", url: "https://secret.com/", windowId: "w" },
    c: { id: "c", profileId: "default", url: "universe://history", windowId: "w" },
  };
  const open = openSitesOf(tabs, () => "chromium");
  assert.equal(open.size, 1);
  assert.equal(open.get("default\nexample.com")?.host, "example.com");
});
