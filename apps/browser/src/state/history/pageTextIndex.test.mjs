import assert from "node:assert/strict";
import { test } from "node:test";
const { PageTextIndex, pageTextMatchExpression, searchHistoryEntries } = await import("./pageTextIndex.ts");

const entries = [
  { url: "https://cats.example/guide", title: "Cat care guide", favicon: null, visits: 3, lastVisit: 1000, visitTimes: [1000] },
  { url: "https://dogs.example/guide", title: "Dog care guide", favicon: null, visits: 1, lastVisit: 2000, visitTimes: [2000] },
  { url: "https://birds.example/guide", title: "Bird watching", favicon: null, visits: 5, lastVisit: 3000, visitTimes: [3000] },
];

test("page text search needs every word as a prefix and ranks title hits first", () => {
  const index = new PageTextIndex();
  index.record("https://cats.example/guide", "Cat care guide", "Cats need fresh water and a quiet place to sleep. Kittens play all day.", 1000);
  index.record("https://dogs.example/guide", "Dog care guide", "Dogs need walks and fresh water every day.", 2000);
  assert.equal(index.size, 2);
  const water = index.search("fresh water", 10);
  assert.equal(water.length, 2);
  assert.equal(water[0].url, "https://dogs.example/guide");
  assert.ok(water[0].snippet.includes("fresh water"));
  assert.deepEqual(index.search("kittens play", 10).map((m) => m.url), ["https://cats.example/guide"]);
  assert.deepEqual(index.search("fresh zebra", 10), []);
  assert.deepEqual(index.search("kitt", 10).map((m) => m.url), ["https://cats.example/guide"]);
  assert.deepEqual(index.search("", 10), []);
});

test("recording the same url replaces its text and deleting or retaining prunes it", () => {
  const index = new PageTextIndex();
  index.record("https://a.test/", "Alpha", "first body", 1000);
  index.record("https://a.test/", "Alpha", "second body", 2000);
  assert.deepEqual(index.search("first", 10), []);
  assert.deepEqual(index.search("second", 10).map((m) => m.url), ["https://a.test/"]);
  index.record("https://b.test/", "Beta", "second body too", 3000);
  index.retain(new Set(["https://a.test/"]));
  assert.equal(index.size, 1);
  assert.equal(index.delete("https://a.test/"), true);
  assert.equal(index.delete("https://a.test/"), false);
  assert.equal(index.size, 0);
  index.record("https://c.test/", "Gamma", "hello world", 4000);
  index.erase();
  assert.equal(index.size, 0);
  index.record("ftp://c.test/", "Gamma", "hello world", 4000);
  assert.equal(index.size, 0);
});

test("history search puts title and url matches first and page-text matches after them", () => {
  const index = new PageTextIndex();
  index.record("https://cats.example/guide", "Cat care guide", "Cats need fresh water daily.", 1000);
  index.record("https://dogs.example/guide", "Dog care guide", "Dogs need fresh water daily.", 2000);
  index.record("https://birds.example/guide", "Bird watching", "Birds drink fresh water too.", 3000);
  const found = searchHistoryEntries(entries, "fresh water", { searchPageText: true, index });
  assert.deepEqual(found.map((e) => e.url), [
    "https://birds.example/guide",
    "https://dogs.example/guide",
    "https://cats.example/guide",
  ]);
  const titled = searchHistoryEntries(entries, "cat care", { searchPageText: true, index });
  assert.deepEqual(titled.map((e) => e.url), ["https://cats.example/guide"]);
  const off = searchHistoryEntries(entries, "fresh water", { searchPageText: false, index });
  assert.deepEqual(off, []);
  const short = searchHistoryEntries(entries, "fr", { searchPageText: true, index });
  assert.deepEqual(short, []);
});

test("the match expression quotes each word as a prefix term so query punctuation cannot reach the parser", () => {
  assert.equal(pageTextMatchExpression("fresh water"), '"fresh"* "water"*');
  assert.equal(pageTextMatchExpression('a"b c'), '"a""b"* "c"*');
  assert.equal(pageTextMatchExpression("  "), null);
  assert.equal(pageTextMatchExpression("!!!"), null);
});
