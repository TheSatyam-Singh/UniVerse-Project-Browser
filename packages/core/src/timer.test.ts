import assert from "node:assert/strict";
import { test } from "node:test";
import { humanizeDuration, parseTimer } from "./timer.ts";

test("timer parses minutes, seconds and hours", () => {
  assert.deepEqual(parseTimer("timer 5 min"), { seconds: 300, label: "5 minutes" });
  assert.deepEqual(parseTimer("timer 90s"), { seconds: 90, label: "1 minute 30 seconds" });
  assert.deepEqual(parseTimer("timer 1h30m"), { seconds: 5400, label: "1 hour 30 minutes" });
  assert.deepEqual(parseTimer("timer 2 hours"), { seconds: 7200, label: "2 hours" });
  assert.deepEqual(parseTimer("5 minute timer"), { seconds: 300, label: "5 minutes" });
  assert.deepEqual(parseTimer("timer 10 seconds"), { seconds: 10, label: "10 seconds" });
});

test("timer accepts a bare duration phrase", () => {
  assert.deepEqual(parseTimer("25 minutes"), { seconds: 1500, label: "25 minutes" });
  assert.equal(parseTimer("25"), null);
  assert.equal(parseTimer("timer"), null);
  assert.equal(parseTimer("timer abc"), null);
  assert.equal(parseTimer("5 min read"), null);
});

test("timer clamps to one second and one day", () => {
  assert.equal(parseTimer("timer 0s"), null);
  assert.deepEqual(parseTimer("timer 48 hours"), { seconds: 86400, label: "24 hours" });
  assert.deepEqual(parseTimer("timer 1.5 hours"), { seconds: 5400, label: "1 hour 30 minutes" });
});

test("humanizeDuration pluralizes", () => {
  assert.equal(humanizeDuration(1), "1 second");
  assert.equal(humanizeDuration(60), "1 minute");
  assert.equal(humanizeDuration(3600), "1 hour");
  assert.equal(humanizeDuration(3661), "1 hour 1 minute");
});
