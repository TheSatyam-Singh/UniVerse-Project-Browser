import assert from "node:assert/strict";
import { test } from "node:test";
const { canRetryDownload, downloadHistoryJson, keptDownloadHistory, MAX_DOWNLOAD_HISTORY, parseDownloadHistory } = await import("./history.ts");

const download = (over = {}) => ({
  id: "d1",
  url: "https://example.com/file.zip",
  filename: "file.zip",
  path: "/Users/test/Downloads/file.zip",
  state: "finished",
  paused: false,
  received: 100,
  total: 100,
  speed: 0,
  mimeType: "application/zip",
  ...over,
});

test("history keeps ended downloads, drops in-progress and private ones, newest first", () => {
  const list = [
    download({ id: "a" }),
    download({ id: "b", state: "downloading", received: 10 }),
    download({ id: "c", state: "failed", path: "" }),
    download({ id: "d", state: "cancelled", path: "" }),
    download({ id: "e", offTheRecord: true }),
  ];
  assert.deepEqual(
    keptDownloadHistory(list).map((d) => d.id),
    ["a", "c", "d"],
  );
  assert.equal(keptDownloadHistory(list).length, 3);
});

test("history is capped at the newest entries", () => {
  const list = Array.from({ length: MAX_DOWNLOAD_HISTORY + 5 }, (_, i) => download({ id: `d${i}` }));
  assert.equal(keptDownloadHistory(list).length, MAX_DOWNLOAD_HISTORY);
  assert.equal(keptDownloadHistory(list).at(-1)?.id, `d${MAX_DOWNLOAD_HISTORY - 1}`);
});

test("a saved history round-trips through JSON", () => {
  const list = [download({ id: "a" }), download({ id: "b", state: "failed", path: "" })];
  const parsed = parseDownloadHistory(downloadHistoryJson(list));
  assert.deepEqual(
    parsed.map((d) => [d.id, d.state, d.url]),
    [
      ["a", "finished", "https://example.com/file.zip"],
      ["b", "failed", "https://example.com/file.zip"],
    ],
  );
});

test("parsing tolerates corrupt, wrong-shaped and partial history", () => {
  assert.deepEqual(parseDownloadHistory(null), []);
  assert.deepEqual(parseDownloadHistory(""), []);
  assert.deepEqual(parseDownloadHistory("not json"), []);
  assert.deepEqual(parseDownloadHistory(JSON.stringify({ version: 1 })), []);
  assert.deepEqual(
    parseDownloadHistory(JSON.stringify([download({ id: "a" })])).map((d) => [d.id, d.state, d.filename]),
    [["a", "finished", "file.zip"]],
  );
  const mixed = JSON.stringify({ version: 1, downloads: [download({ id: "a" }), { id: "b" }, download({ id: "c", state: "nope" }), download({ id: "d", received: "x" })] });
  assert.deepEqual(
    parseDownloadHistory(mixed).map((d) => d.id),
    ["a"],
  );
});

test("only a failed download can be retried", () => {
  assert.equal(canRetryDownload(download({ state: "failed" })), true);
  assert.equal(canRetryDownload(download({ state: "finished" })), false);
  assert.equal(canRetryDownload(download({ state: "downloading" })), false);
  assert.equal(canRetryDownload(download({ state: "cancelled" })), false);
});
