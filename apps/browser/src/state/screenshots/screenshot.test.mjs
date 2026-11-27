import assert from "node:assert/strict";
import { test } from "node:test";
const { screenshotFileName } = await import("./screenshot.ts");
const { noteScreenshotTaken, takeScreenshotCounts } = await import("../telemetry/screenshots.ts");

const at = new Date(2026, 10, 27, 13, 26, 47);

test("the file name carries the host and the local date and time", () => {
  assert.equal(screenshotFileName("https://example.com/some/page", false, at), "Screenshot example.com 2026-11-27 at 13.26.47.png");
  assert.equal(screenshotFileName("https://example.com/some/page", true, at), "Full Page Screenshot example.com 2026-11-27 at 13.26.47.png");
});

test("the host is sanitized so the name is a safe file name", () => {
  assert.equal(screenshotFileName("https://example.com:8080/x", false, at), "Screenshot example.com-8080 2026-11-27 at 13.26.47.png");
  assert.equal(screenshotFileName("https://user@exa_mple.com/x", false, at), "Screenshot exa_mple.com 2026-11-27 at 13.26.47.png");
});

test("pages without a host fall back to page", () => {
  assert.equal(screenshotFileName("about:blank", false, at), "Screenshot page 2026-11-27 at 13.26.47.png");
  assert.equal(screenshotFileName("not a url", false, at), "Screenshot page 2026-11-27 at 13.26.47.png");
  assert.equal(screenshotFileName("universe://newtab", false, at), "Screenshot newtab 2026-11-27 at 13.26.47.png");
});

test("screenshot counts separate visible and full-page captures and reset when taken", () => {
  noteScreenshotTaken(false);
  noteScreenshotTaken(true);
  noteScreenshotTaken(true);
  assert.deepEqual(takeScreenshotCounts(), { screenshots_taken: 3, full_page_screenshots_taken: 2 });
  assert.deepEqual(takeScreenshotCounts(), { screenshots_taken: 0, full_page_screenshots_taken: 0 });
});
