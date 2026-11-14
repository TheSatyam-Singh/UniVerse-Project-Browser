import { test } from "node:test";
import assert from "node:assert/strict";
import { allowsAutomaticPiP, pickPipVideoScript, refusesAutomaticVideo, returnToPipTab } from "./pipUx.ts";
import {
  LINK_PREVIEW_CACHE_LIMIT,
  LinkPreviewCache,
  extractLinkPreview,
  isReservedAddress,
  mayFetchLinkPreview,
  stripTrackingParams,
} from "../peek/linkPreview.ts";
import { acceptedTidyName, isMessyFilename, proposeTidyName, recordTidyRename, shouldTidyDownload, tidyFileExtension } from "../downloads/tidy.ts";
import { applySiteZoom, nextZoomLevel, resetSiteZoom, resetSiteZoomForTests, restoreSiteZoom, zoomPercentage } from "../site/siteZoom.ts";

test("automatic PiP refuses instagram, tiktok and youtube shorts", () => {
  assert.equal(allowsAutomaticPiP("https://www.instagram.com/p/abc"), false);
  assert.equal(allowsAutomaticPiP("https://instagram.com/reel/1"), false);
  assert.equal(allowsAutomaticPiP("https://www.tiktok.com/@x/video/1"), false);
  assert.equal(allowsAutomaticPiP("https://www.youtube.com/shorts/abc"), false);
  assert.equal(allowsAutomaticPiP("https://www.youtube.com/watch?v=abc"), true);
  assert.equal(allowsAutomaticPiP("https://example.com/video"), true);
  assert.equal(allowsAutomaticPiP("not a url"), false);
});

test("automatic PiP refuses videos that are not playing, silent, looping or portrait", () => {
  const playing = { playing: true, muted: false, volume: 0.8, loop: false, width: 1280, height: 720 };
  assert.equal(refusesAutomaticVideo(playing), false);
  assert.equal(refusesAutomaticVideo({ ...playing, playing: false }), true);
  assert.equal(refusesAutomaticVideo({ ...playing, muted: true }), true);
  assert.equal(refusesAutomaticVideo({ ...playing, volume: 0 }), true);
  assert.equal(refusesAutomaticVideo({ ...playing, loop: true }), true);
  assert.equal(refusesAutomaticVideo({ ...playing, width: 720, height: 1280 }), true);
});

test("the PiP picker script picks playing videos and refuses the rest", () => {
  const script = pickPipVideoScript();
  assert.match(script, /universePickVideo/);
  assert.match(script, /universeRefusesAutomatic/);
});

test("returning to the PiP tab activates it and focuses its window", () => {
  const calls = [];
  const ctx = {
    tabWindowId: "w1",
    activate: (id) => calls.push(`activate ${id}`),
    focusWindow: (id) => calls.push(`focus ${id}`),
  };
  assert.equal(returnToPipTab("t1", ctx), true);
  assert.deepEqual(calls, ["activate t1", "focus w1"]);
  assert.equal(returnToPipTab("t1", { ...ctx, tabWindowId: undefined }), false);
});

test("link previews refuse private pages, local hosts and reserved addresses", () => {
  assert.equal(mayFetchLinkPreview("https://example.com/page"), true);
  assert.equal(mayFetchLinkPreview("https://example.com/page", { isPrivate: true }), false);
  assert.equal(mayFetchLinkPreview("https://example.com/page", { isAgent: true }), false);
  assert.equal(mayFetchLinkPreview("https://example.com/page", { blocked: true }), false);
  assert.equal(mayFetchLinkPreview("http://localhost:3000/"), false);
  assert.equal(mayFetchLinkPreview("https://router.local/"), false);
  assert.equal(mayFetchLinkPreview("https://192.168.1.1/"), false);
  assert.equal(mayFetchLinkPreview("https://10.0.0.5/"), false);
  assert.equal(mayFetchLinkPreview("https://127.0.0.1/"), false);
  assert.equal(mayFetchLinkPreview("https://169.254.1.1/"), false);
  assert.equal(mayFetchLinkPreview("https://[::1]/"), false);
  assert.equal(mayFetchLinkPreview("https://[fe80::1]/"), false);
  assert.equal(mayFetchLinkPreview("https://singlelabel/"), false);
  assert.equal(mayFetchLinkPreview("ftp://example.com/file"), false);
  assert.equal(mayFetchLinkPreview("not a url"), false);
});

test("reserved addresses cover the loopback, private, link-local and multicast ranges", () => {
  assert.equal(isReservedAddress("172.16.5.4"), true);
  assert.equal(isReservedAddress("172.31.255.255"), true);
  assert.equal(isReservedAddress("172.32.0.1"), false);
  assert.equal(isReservedAddress("100.64.0.1"), true);
  assert.equal(isReservedAddress("198.18.0.1"), true);
  assert.equal(isReservedAddress("224.0.0.1"), true);
  assert.equal(isReservedAddress("8.8.8.8"), false);
  assert.equal(isReservedAddress("::ffff:192.168.1.1"), true);
  assert.equal(isReservedAddress("64:ff9b::192.168.1.1"), true);
  assert.equal(isReservedAddress("example.com"), false);
});

test("tracking parameters are stripped from preview urls", () => {
  assert.equal(
    stripTrackingParams("https://example.com/a?utm_source=x&fbclid=1&keep=2"),
    "https://example.com/a?keep=2",
  );
  assert.equal(stripTrackingParams("not a url"), null);
});

test("link extraction reads title, description, image, icon and body text", () => {
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="The Title">
    <meta name="description" content="A short description.">
    <meta property="og:image" content="/img/cover.png">
    <meta property="og:site_name" content="Example News">
    <link rel="icon" href="/favicon.ico">
    <title>Fallback Title</title></head><body>
    <script>var x = 1;</script>
    <p>Short.</p>
    <p>This is a long paragraph with more than forty characters in it, for the preview text.</p>
    <p>Another long paragraph with more than forty characters in it, for the preview text.</p>
    </body></html>`;
  const page = extractLinkPreview(html, "https://example.com/article");
  assert.equal(page.title, "The Title");
  assert.equal(page.description, "A short description.");
  assert.equal(page.imageUrl, "https://example.com/img/cover.png");
  assert.equal(page.iconUrl, "https://example.com/favicon.ico");
  assert.equal(page.siteName, "Example News");
  assert.match(page.text, /long paragraph/);
  assert.equal(page.text.includes("Short."), false);
});

test("link extraction decodes entities and falls back to the title tag", () => {
  const page = extractLinkPreview(
    "<html><head><title>Fish &amp; Chips &mdash; News</title></head><body><p>This paragraph is long enough to be kept in the preview text.</p></body></html>",
    "https://example.com/",
  );
  assert.equal(page.title, "Fish & Chips — News");
});

test("the preview cache keeps sixty entries and follows gated redirects", async () => {
  const cache = new LinkPreviewCache();
  const fetchImpl = async (url) => {
    if (url === "https://example.com/short") {
      return {
        status: 302,
        headers: { get: (name) => (name === "location" ? "https://example.com/real" : null) },
        url,
        text: async () => "",
      };
    }
    return {
      status: 200,
      headers: { get: () => null },
      url,
      text: async () =>
        "<html><head><title>Real Page</title></head><body><p>This paragraph is long enough to be kept in the preview text.</p></body></html>",
    };
  };
  const state = await cache.load("https://example.com/short?utm_source=x", fetchImpl);
  assert.equal(state.status, "ready");
  if (state.status === "ready") {
    assert.equal(state.page.title, "Real Page");
    assert.equal(state.page.landedUrl, "https://example.com/real");
  }
  assert.equal(await cache.load("https://192.168.1.1/", fetchImpl), cache.get("https://192.168.1.1/"));
  assert.equal(cache.get("https://192.168.1.1/")?.status, "failed");
  for (let i = 0; i < LINK_PREVIEW_CACHE_LIMIT + 5; i++) {
    await cache.load(`https://example.com/page-${i}`, fetchImpl);
  }
  assert.equal(cache.get("https://example.com/short?utm_source=x"), undefined);
});

test("tidy downloads only run for automatic folders, public pages and network files", () => {
  assert.equal(shouldTidyDownload(true, false, "network"), true);
  assert.equal(shouldTidyDownload(false, false, "network"), false);
  assert.equal(shouldTidyDownload(true, true, "network"), false);
  assert.equal(shouldTidyDownload(true, false, "local"), false);
});

test("messy names are hashes, long numbers, generic words and camera files", () => {
  assert.equal(isMessyFilename("a3f9c21e8b04.pdf"), true);
  assert.equal(isMessyFilename("550e8400-e29b-41d4-a716-446655440000.zip"), true);
  assert.equal(isMessyFilename("20261114120000.png"), true);
  assert.equal(isMessyFilename("download.pdf"), true);
  assert.equal(isMessyFilename("Report (2).pdf"), true);
  assert.equal(isMessyFilename("IMG_20261114.jpg"), true);
  assert.equal(isMessyFilename("DSC0042.jpg"), true);
  assert.equal(isMessyFilename("Screenshot 2026-11-14.png"), true);
  assert.equal(isMessyFilename("Quarterly Report.pdf"), false);
  assert.equal(isMessyFilename("notes.txt"), false);
});

test("tidy extensions keep tar.gz together", () => {
  assert.equal(tidyFileExtension("archive.tar.gz"), "tar.gz");
  assert.equal(tidyFileExtension("photo.JPG"), "JPG");
  assert.equal(tidyFileExtension("README"), "");
});

test("accepted tidy names keep the extension, stay short and must differ", () => {
  assert.equal(acceptedTidyName("Quarterly Report", "a3f9c21e.pdf"), "Quarterly Report.pdf");
  assert.equal(acceptedTidyName("Quarterly Report.pdf", "a3f9c21e.pdf"), "Quarterly Report.pdf");
  assert.equal(acceptedTidyName("archive.tar.gz", "x.tar.gz"), "archive.tar.gz");
  assert.equal(acceptedTidyName("x.tar.gz", "x.tar.gz"), null);
  assert.equal(acceptedTidyName(".hidden", "x.pdf"), null);
  assert.equal(acceptedTidyName("same", "same.pdf"), null);
  assert.equal(acceptedTidyName("a".repeat(100), "x.pdf"), `${"a".repeat(60)}.pdf`);
  assert.equal(acceptedTidyName("Report / Notes: Q1", "x.pdf"), "Report Notes Q1.pdf");
  assert.equal(acceptedTidyName("12345", "x.pdf"), null);
});

test("a tidy proposal waits at most a second and a half on the namer", async () => {
  const slow = () => new Promise((resolve) => setTimeout(() => resolve("Too Late"), 5000));
  assert.equal(await proposeTidyName({ url: "https://example.com/x", filename: "a3f9c21e.pdf" }, slow), null);
  const fast = async () => "Quarterly Report";
  assert.equal(
    await proposeTidyName({ url: "https://example.com/x", filename: "a3f9c21e.pdf" }, fast),
    "Quarterly Report.pdf",
  );
  assert.equal(await proposeTidyName({ url: "https://example.com/x", filename: "Quarterly Report.pdf" }, fast), null);
  assert.equal(await proposeTidyName({ url: "https://example.com/x", filename: "a3f9c21e.pdf" }, null), null);
});

test("recording a tidy rename keeps the original name", () => {
  const download = { filename: "a3f9c21e.pdf" };
  const renamed = recordTidyRename(download, "Quarterly Report.pdf");
  assert.equal(renamed.filename, "Quarterly Report.pdf");
  assert.equal(renamed.renamedFrom, "a3f9c21e.pdf");
});

test("zoom steps follow the ladder with a tolerance for the current level", () => {
  assert.equal(nextZoomLevel(1, "up"), 1.1);
  assert.equal(nextZoomLevel(1, "down"), 0.9);
  assert.equal(nextZoomLevel(0.9, "down"), 0.8);
  assert.equal(nextZoomLevel(2, "up"), 2);
  assert.equal(nextZoomLevel(0.5, "down"), 0.5);
  assert.equal(nextZoomLevel(1.04, "up"), 1.1);
  assert.equal(zoomPercentage(1.25), 125);
});

test("site zoom remembers private levels in memory and resets to one hundred percent", async () => {
  resetSiteZoomForTests();
  assert.equal(await restoreSiteZoom("p1", "example.com", true), 1);
  assert.equal(await applySiteZoom("p1", "example.com", 1.25, true), 1.25);
  assert.equal(await restoreSiteZoom("p1", "example.com", true), 1.25);
  assert.equal(await resetSiteZoom("p1", "example.com", true), 1);
  assert.equal(await restoreSiteZoom("p1", "example.com", true), 1);
});
