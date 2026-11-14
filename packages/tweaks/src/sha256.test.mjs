import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { sha256Hex } from "./sha256.ts";

test("sha256 matches node crypto on short and long inputs", () => {
  const inputs = ["", "abc", "hello world", "dQw4w9WgXcQ", "a".repeat(55), "a".repeat(56), "a".repeat(64), "a".repeat(200)];
  for (const input of inputs) {
    assert.equal(sha256Hex(input), createHash("sha256").update(input).digest("hex"), JSON.stringify(input));
  }
});

test("sha256 of abc is the FIPS vector", () => {
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
