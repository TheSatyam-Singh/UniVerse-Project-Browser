import assert from "node:assert/strict";
import { test } from "node:test";

const {
  canSaveToReadingList,
  parseReadingList,
  readingListItemOf,
  readingListSiteOf,
  serializeReadingList,
  withReadingListItem,
  withoutReadingListItem,
  MAX_READING_LIST,
} = await import("./readingListDocument.ts");

test("readingListSiteOf strips www and lowercases the host", () => {
  assert.equal(readingListSiteOf("https://www.example.com/path"), "example.com");
  assert.equal(readingListSiteOf("https://sub.example.com/"), "sub.example.com");
  assert.equal(readingListSiteOf("not a url"), "");
});

test("canSaveToReadingList accepts only http and https pages", () => {
  assert.equal(canSaveToReadingList("https://example.com/"), true);
  assert.equal(canSaveToReadingList("http://example.com/"), true);
  assert.equal(canSaveToReadingList("universe://history"), false);
  assert.equal(canSaveToReadingList("file:///tmp/page.html"), false);
  assert.equal(canSaveToReadingList(undefined), false);
});

test("parseReadingList and serializeReadingList round-trip", () => {
  const items = [
    readingListItemOf("https://example.com/a", "Example A", null, 100),
    readingListItemOf("https://other.org/b", "Other B", "https://other.org/favicon.ico", 200),
  ];
  assert.deepEqual(parseReadingList(serializeReadingList(items)), items);
});

test("parseReadingList returns [] for missing or broken documents", () => {
  assert.deepEqual(parseReadingList(null), []);
  assert.deepEqual(parseReadingList(undefined), []);
  assert.deepEqual(parseReadingList(""), []);
  assert.deepEqual(parseReadingList("not json"), []);
  assert.deepEqual(parseReadingList("{}"), []);
  assert.deepEqual(parseReadingList(JSON.stringify({ items: "nope" })), []);
});

test("parseReadingList skips bad rows and fills the site from the url", () => {
  const doc = JSON.stringify({
    items: [
      { url: "https://example.com/a", title: "A", addedAt: 100 },
      { url: "https://example.com/b" },
      { title: "No url" },
      "junk",
      { url: "https://other.org/c", title: "C", site: "kept.org", favicon: 42, addedAt: "soon" },
    ],
  });
  assert.deepEqual(parseReadingList(doc), [
    { url: "https://example.com/a", title: "A", site: "example.com", favicon: null, addedAt: 100 },
    { url: "https://other.org/c", title: "C", site: "kept.org", favicon: null, addedAt: 0 },
  ]);
});

test("withReadingListItem saves newest first, dedupes by url and caps the list", () => {
  const first = readingListItemOf("https://example.com/a", "A", null, 1);
  const second = readingListItemOf("https://example.com/b", "B", null, 2);
  const again = readingListItemOf("https://example.com/a", "A again", null, 3);
  assert.deepEqual(withReadingListItem([first], second), [second, first]);
  assert.deepEqual(withReadingListItem([first, second], again), [again, second]);
  const many = Array.from({ length: MAX_READING_LIST + 10 }, (_, i) => readingListItemOf(`https://example.com/${i}`, `${i}`, null, i));
  assert.equal(withReadingListItem([], many[0]).length, 1);
  assert.equal(withReadingListItem(many, readingListItemOf("https://example.com/new", "New", null, 999)).length, MAX_READING_LIST);
});

test("withoutReadingListItem removes only the matching url", () => {
  const items = [
    readingListItemOf("https://example.com/a", "A", null, 1),
    readingListItemOf("https://example.com/b", "B", null, 2),
  ];
  assert.deepEqual(withoutReadingListItem(items, "https://example.com/a"), [items[1]]);
  assert.deepEqual(withoutReadingListItem(items, "https://example.com/missing"), items);
});
