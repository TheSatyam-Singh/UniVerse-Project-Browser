import assert from "node:assert/strict";
import { test } from "node:test";
import { paragraphsOf } from "./pdfDocument.ts";

test("paragraphsOf splits on blank lines", () => {
  const text = "First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here.";
  assert.deepEqual(paragraphsOf(text), ["First paragraph here.", "Second paragraph here.", "Third paragraph here."]);
});

test("paragraphsOf falls back to single newlines when there are no blank lines", () => {
  const text = "Line one here.\nLine two here.\nLine three here.";
  assert.deepEqual(paragraphsOf(text), ["Line one here.", "Line two here.", "Line three here."]);
});

test("paragraphsOf collapses extra whitespace and drops empties", () => {
  const text = "  Spaced   out   text.  \n\n\n\nAnother one.  ";
  assert.deepEqual(paragraphsOf(text), ["Spaced out text.", "Another one."]);
});

test("paragraphsOf returns an empty list for blank text", () => {
  assert.deepEqual(paragraphsOf("   \n\n  "), []);
  assert.deepEqual(paragraphsOf(""), []);
});
