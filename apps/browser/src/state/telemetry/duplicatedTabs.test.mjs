import assert from "node:assert/strict";
import { test } from "node:test";
import { noteTabDuplicated, takeDuplicatedTabCounts } from "./duplicatedTabs.ts";

test("duplicated tabs are counted, and taking them starts over", () => {
  noteTabDuplicated();
  noteTabDuplicated();
  assert.deepEqual(takeDuplicatedTabCounts(), { tabs_duplicated: 2 });
  assert.deepEqual(takeDuplicatedTabCounts(), { tabs_duplicated: 0 });
});
