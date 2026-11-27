import assert from "node:assert/strict";
import { test } from "node:test";
import { noteClosedTabRestoredFromHistory, takeClosedTabRestoreCounts } from "./closedTabs.ts";

test("closed tabs reopened from History are counted, and taking them starts over", () => {
  noteClosedTabRestoredFromHistory();
  noteClosedTabRestoredFromHistory();
  assert.deepEqual(takeClosedTabRestoreCounts(), { closed_tabs_restored_from_history: 2 });
  assert.deepEqual(takeClosedTabRestoreCounts(), { closed_tabs_restored_from_history: 0 });
});
