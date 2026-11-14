import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultSponsorBlockCategoryOptions,
  enabledSponsorBlockCategories,
  isValidSegment,
  isYouTubeDomain,
  sponsorBlockHashPrefix,
  SponsorBlockClient,
} from "./sponsorBlock.ts";

const seg = (over = {}) => ({
  UUID: "u1",
  segment: [10, 20],
  category: "sponsor",
  actionType: "skip",
  ...over,
});

test("youtube domains include subdomains of youtube.com", () => {
  assert.equal(isYouTubeDomain("youtube.com"), true);
  assert.equal(isYouTubeDomain("www.youtube.com"), true);
  assert.equal(isYouTubeDomain("music.youtube.com"), true);
  assert.equal(isYouTubeDomain("youtu.be"), true);
  assert.equal(isYouTubeDomain("www.notyoutube.com"), false);
  assert.equal(isYouTubeDomain("youtube.com.evil.example"), false);
  assert.equal(isYouTubeDomain("example.com"), false);
});

test("defaults auto-skip sponsors, show a button for highlights, disable the rest", () => {
  const options = defaultSponsorBlockCategoryOptions();
  assert.equal(options.sponsor, "auto");
  assert.equal(options.poi_highlight, "manual");
  assert.equal(options.intro, "disabled");
  assert.deepEqual(enabledSponsorBlockCategories(options), ["sponsor", "poi_highlight"]);
});

test("hash prefix is the first four hex chars of the sha256", () => {
  const prefix = sponsorBlockHashPrefix("dQw4w9WgXcQ");
  assert.match(prefix, /^[0-9a-f]{4}$/);
  assert.notEqual(prefix, sponsorBlockHashPrefix("dQw4w9WgXcR"));
});

test("segment validation rejects ranges that would skip a video to its end", () => {
  assert.equal(isValidSegment(seg()), true);
  assert.equal(isValidSegment(seg({ segment: [0, 1e9] })), false);
  assert.equal(isValidSegment(seg({ segment: [20, 10] })), false);
  assert.equal(isValidSegment(seg({ segment: [NaN, 20] })), false);
  assert.equal(isValidSegment(seg({ segment: [10] })), false);
  assert.equal(isValidSegment(seg({ segment: [-1, 20] })), false);
});

test("fetchSegments uses the hash-prefix endpoint and filters to enabled skip/mute segments", async () => {
  const seen = [];
  const fetchFn = async (url) => {
    seen.push(url);
    return {
      status: 200,
      json: async () => [
        {
          videoID: "vid1",
          segments: [
            seg({ UUID: "a", segment: [30, 40], category: "sponsor" }),
            seg({ UUID: "b", segment: [5, 8], category: "intro" }),
            seg({ UUID: "c", segment: [50, 60], category: "sponsor", actionType: "full" }),
            seg({ UUID: "d", segment: [70, 80], category: "sponsor", actionType: "mute" }),
            seg({ UUID: "e", segment: [0, 1e9], category: "sponsor" }),
          ],
        },
      ],
    };
  };
  const client = new SponsorBlockClient({ enabled: true, categoryOptions: defaultSponsorBlockCategoryOptions(), fetchFn });
  const segments = await client.fetchSegments("vid1");
  assert.deepEqual(segments.map((s) => s.UUID), ["a", "d"]);
  assert.match(seen[0], /skipSegments\/[0-9a-f]{4}\?categories=/);
  assert.match(seen[0], /sponsor/);
  assert.doesNotMatch(seen[0], /intro/);
});

test("fetchSegments caches for an hour and a 404 caches as empty", async () => {
  let calls = 0;
  let now = 1000;
  const fetchFn = async () => {
    calls += 1;
    return { status: 404, json: async () => ({}) };
  };
  const client = new SponsorBlockClient({
    enabled: true,
    categoryOptions: defaultSponsorBlockCategoryOptions(),
    fetchFn,
    now: () => now,
  });
  assert.deepEqual(await client.fetchSegments("vid9"), []);
  assert.deepEqual(await client.fetchSegments("vid9"), []);
  assert.equal(calls, 1);
  now += 3600_000;
  assert.deepEqual(await client.fetchSegments("vid9"), []);
  assert.equal(calls, 2);
});

test("fetchSegments returns nothing when disabled or when every category is off", async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return { status: 200, json: async () => [] };
  };
  const off = new SponsorBlockClient({ enabled: false, categoryOptions: defaultSponsorBlockCategoryOptions(), fetchFn });
  assert.deepEqual(await off.fetchSegments("vid1"), []);
  const none = new SponsorBlockClient({
    enabled: true,
    categoryOptions: Object.fromEntries(Object.keys(defaultSponsorBlockCategoryOptions()).map((k) => [k, "disabled"])),
    fetchFn,
  });
  assert.deepEqual(await none.fetchSegments("vid1"), []);
  assert.equal(calls, 0);
});

test("deliver script hands segments to the page script", () => {
  const js = SponsorBlockClient.deliverScript([seg()], defaultSponsorBlockCategoryOptions());
  assert.match(js, /__universeSponsorBlock\?\.receiveSegments/);
  assert.match(js, /"sponsor"/);
});
