import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALL_FILTER_LISTS,
  DEFAULT_FILTER_LISTS,
  OPTIONAL_FILTER_LISTS,
  enabledFilterLists,
  filterListLooksValid,
  filterListUpdateDue,
  filterListUpdateIntervalMs,
} from "./filterLists.ts";

const DAY = 86_400_000;
const HOUR = 3_600_000;

test("the catalog holds ten default lists and eighteen optional ones, all over https with unique filenames", () => {
  assert.equal(DEFAULT_FILTER_LISTS.length, 10);
  assert.equal(OPTIONAL_FILTER_LISTS.length, 18);
  const filenames = ALL_FILTER_LISTS.map((l) => l.filename);
  assert.equal(new Set(filenames).size, filenames.length);
  for (const list of ALL_FILTER_LISTS) {
    assert.ok(list.url.startsWith("https://"), list.filename);
    assert.ok(list.minBytes > 0 && list.maxBytes > list.minBytes, list.filename);
  }
});

test("the update interval comes from the list Expires header, clamped to one hour through seven days", () => {
  assert.equal(filterListUpdateIntervalMs("! Title: x\n! Expires: 2 days\n"), 2 * DAY);
  assert.equal(filterListUpdateIntervalMs("! Expires: 4 hours\n"), 4 * HOUR);
  assert.equal(filterListUpdateIntervalMs("! Expires: 100 days\n"), 7 * DAY);
  assert.equal(filterListUpdateIntervalMs("! Expires: 0 days\n"), HOUR);
  assert.equal(filterListUpdateIntervalMs("! Title: x\n"), 24 * HOUR);
  assert.equal(filterListUpdateIntervalMs(""), 24 * HOUR);
});

test("a list is due when never checked or past its interval, and not before", () => {
  const header = "! Expires: 1 days\n";
  const now = Date.now();
  assert.equal(filterListUpdateDue(null, header, now), true);
  assert.equal(filterListUpdateDue(now - HOUR, header, now), false);
  assert.equal(filterListUpdateDue(now - DAY - 1, header, now), true);
});

test("a snapshot is valid only inside its size range with a list-like first line", () => {
  const entry = DEFAULT_FILTER_LISTS[0]!;
  assert.equal(filterListLooksValid(`[Adblock Plus 2.0]\n${"x".repeat(entry.minBytes)}`, entry), true);
  assert.equal(filterListLooksValid("tiny", entry), false);
  assert.equal(filterListLooksValid(`garbage\n${"x".repeat(entry.minBytes)}`, entry), false);
});

test("enabled lists are the defaults plus the optional filenames the user turned on", () => {
  assert.equal(enabledFilterLists([]).length, 10);
  const enabled = enabledFilterLists(["ublock-annoyances-cookies.txt", "indianlist.txt"]);
  assert.equal(enabled.length, 12);
  assert.ok(enabled.some((l) => l.filename === "indianlist.txt"));
  assert.ok(enabled.every((l) => !l.isOptional || ["ublock-annoyances-cookies.txt", "indianlist.txt"].includes(l.filename)));
});
