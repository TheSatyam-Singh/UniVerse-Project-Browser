import assert from "node:assert/strict";
import { test } from "node:test";

const { normalizeSearchUrl, searchEndpoint, createSearchAccumulator, useAiSidebar } = await import("./aiSidebar.ts");
const { useBrowser } = await import("../browser/store.ts");

test("normalizeSearchUrl adds https, strips trailing slashes, and empties blank input", () => {
  assert.equal(normalizeSearchUrl(""), "");
  assert.equal(normalizeSearchUrl("  "), "");
  assert.equal(normalizeSearchUrl("my-search.vercel.app"), "https://my-search.vercel.app");
  assert.equal(normalizeSearchUrl("https://my-search.vercel.app/"), "https://my-search.vercel.app");
  assert.equal(normalizeSearchUrl("http://localhost:3000///"), "http://localhost:3000");
});

test("searchEndpoint appends the search path", () => {
  assert.equal(searchEndpoint("my-search.vercel.app"), "https://my-search.vercel.app/api/search");
});

test("the stream accumulator reads text deltas and sources and ignores other lines", () => {
  const acc = createSearchAccumulator();
  acc.feed("0:\"The answer is \"\n0:\"42.\"\n");
  acc.feed("8:[{\"url\":\"https://example.com/a\",\"title\":\"Example A\"}]\n");
  acc.feed("d:{\"finishReason\":\"stop\"}\n");
  const result = acc.result();
  assert.equal(result.text, "The answer is 42.");
  assert.deepEqual(result.sources, [{ title: "Example A", url: "https://example.com/a" }]);
});

test("the accumulator tolerates a split line across chunks", () => {
  const acc = createSearchAccumulator();
  acc.feed("0:\"Hel");
  acc.feed("lo\"\n");
  assert.equal(acc.result().text, "Hello");
});

test("asking with no backend URL records a notConfigured error and no assistant message", async () => {
  useBrowser.getState().hydrate({});
  useBrowser.getState().updateSettings({ aiSearchUrl: "" });
  const store = useAiSidebar.getState();
  store.clearAi();
  await store.askAi("What is the capital of France?");
  const state = useAiSidebar.getState();
  assert.equal(state.error, "notConfigured");
  assert.equal(state.asking, false);
  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0].role, "user");
});

test("asking with a mocked backend appends the streamed answer and its sources", async () => {
  const stream = "0:\"Paris is the capital \"\n0:\"of France.\"\n8:[{\"url\":\"https://example.com/paris\",\"title\":\"Paris\"}]\n";
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      body: null,
      text: async () => stream,
    };
  };
  useBrowser.getState().hydrate({});
  useBrowser.getState().updateSettings({ aiSearchUrl: "my-search.vercel.app" });
  const store = useAiSidebar.getState();
  store.clearAi();
  await store.askAi("What is the capital of France?");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://my-search.vercel.app/api/search");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model, "universe-nano");
  assert.equal(body.messages[0].parts[0].text, "What is the capital of France?");
  const state = useAiSidebar.getState();
  assert.equal(state.error, null);
  assert.equal(state.asking, false);
  assert.equal(state.messages.length, 2);
  assert.equal(state.messages[1].text, "Paris is the capital of France.");
  assert.deepEqual(state.messages[1].sources, [{ title: "Paris", url: "https://example.com/paris" }]);
  delete globalThis.fetch;
});
