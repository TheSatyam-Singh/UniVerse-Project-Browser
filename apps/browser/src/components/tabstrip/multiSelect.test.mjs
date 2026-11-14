import assert from "node:assert/strict";
import { test } from "node:test";
const { dropAnchorForGroup, multiSelectDropOrder, orderedMultiSelection, rangeWithinSection, stripSectionTabIds } = await import("./multiSelect.ts");

const rows = [
  { id: "a", section: "tabs", isFolder: false },
  { id: "b", section: "tabs", isFolder: false },
  { id: "f", section: "tabs", isFolder: true },
  { id: "c", section: "tabs", isFolder: false },
  { id: "d", section: "pinned", isFolder: false },
];

test("a selection only counts as multi-select with two or more rows, in strip order", () => {
  assert.deepEqual(orderedMultiSelection(["c", "a"], ["a", "b", "c"]), ["a", "c"]);
  assert.deepEqual(orderedMultiSelection(["a"], ["a", "b"]), []);
  assert.deepEqual(orderedMultiSelection([], ["a", "b"]), []);
});

test("a section range covers only that section and skips folders", () => {
  assert.deepEqual(stripSectionTabIds(rows, "a"), ["a", "b", "c"]);
  assert.deepEqual(stripSectionTabIds(rows, "d"), ["d"]);
  assert.deepEqual(stripSectionTabIds(rows, "missing"), []);
  assert.deepEqual(rangeWithinSection(rows, "a", "c"), ["a", "b", "c"]);
  assert.deepEqual(rangeWithinSection(rows, "c", "a"), ["a", "b", "c"]);
  assert.deepEqual(rangeWithinSection(rows, "d", "a"), ["a"]);
});

test("a group drop splits the group around the dragged tab and anchors on the nearest outsider before it", () => {
  assert.deepEqual(multiSelectDropOrder(["a", "b", "c"], "b"), { beforeDragged: ["a"], afterDragged: ["c"] });
  assert.deepEqual(multiSelectDropOrder(["a", "b", "c"], "a"), { beforeDragged: [], afterDragged: ["b", "c"] });
  assert.equal(multiSelectDropOrder(["a", "b"], "z"), null);
  assert.equal(dropAnchorForGroup(["b", "c"], "b", ["x", "b", "c", "y"]), "x");
  assert.equal(dropAnchorForGroup(["b", "c"], "b", ["b", "c", "y"]), null);
  assert.equal(dropAnchorForGroup(["a", "b"], "z", ["a", "b"]), null);
});
