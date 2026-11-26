import assert from "node:assert/strict";
import { test } from "node:test";

const { noteHost, parseNotes, serializeNotes, noteHosts } = await import("./noteDocument.ts");

test("noteHost strips www and lowercases the host", () => {
  assert.equal(noteHost("https://www.example.com/path"), "example.com");
  assert.equal(noteHost("https://sub.example.com/"), "sub.example.com");
  assert.equal(noteHost(undefined), "");
  assert.equal(noteHost(""), "");
});

test("parseNotes and serializeNotes round-trip", () => {
  const notes = {
    "example.com": { text: "hello", updatedAt: 100 },
    "other.org": { text: "world", updatedAt: 200 },
  };
  assert.deepEqual(parseNotes(serializeNotes(notes)), notes);
});

test("parseNotes rejects bad input", () => {
  assert.deepEqual(parseNotes(null), {});
  assert.deepEqual(parseNotes(""), {});
  assert.deepEqual(parseNotes("not json"), {});
  assert.deepEqual(parseNotes(JSON.stringify({ notes: "nope" })), {});
  assert.deepEqual(parseNotes(JSON.stringify({ notes: { "a.com": { text: 42 } } })), {});
});

test("noteHosts lists only non-empty notes, newest first", () => {
  const notes = {
    "old.com": { text: "a", updatedAt: 100 },
    "new.com": { text: "b", updatedAt: 300 },
    "empty.com": { text: "   ", updatedAt: 400 },
    "mid.com": { text: "c", updatedAt: 200 },
  };
  assert.deepEqual(noteHosts(notes), ["new.com", "mid.com", "old.com"]);
});
