import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  bearerTokenOf,
  devMcpFileName,
  fnv1aHash,
  handleDevMcpRpc,
  loadOrCreateDevMcpToken,
  resolveDevMcpPath,
  startDevMcpServer,
} from "./devMcpServer.ts";

const bridge = {
  listTabs: () => [{ index: 0, title: "Example", url: "https://example.com", isActive: true }],
  openUrl: (url) => `Opened ${url}`,
  navigate: (url) => `Navigated to ${url}`,
  readPage: async (maxLength) => `page text (max ${maxLength ?? 8000})`,
  evaluate: async (code) => `eval: ${code}`,
  downloadUrl: async (url, fileName) => fileName,
};

test("dev mcp paths stay under the downloads root and refuse escapes", () => {
  const root = join(tmpdir(), "universe-mcp-test");
  assert.equal(resolveDevMcpPath("notes/page.md", root), join(root, "notes", "page.md"));
  assert.equal(resolveDevMcpPath("../escape.md", root), null);
  assert.equal(resolveDevMcpPath("/absolute.md", root), null);
  assert.equal(resolveDevMcpPath("", root), null);
  assert.equal(resolveDevMcpPath("~/x.md", root), null);
});

test("dev mcp file names hash the url and take the extension from the content type", () => {
  assert.equal(devMcpFileName("https://example.com/photo", "image/png"), `${fnv1aHash("https://example.com/photo")}-photo.png`);
  assert.equal(devMcpFileName("https://example.com/a/b.jpg"), `${fnv1aHash("https://example.com/a/b.jpg")}-b.jpg`);
  assert.equal(fnv1aHash("https://example.com/a").length, 8);
});

test("dev mcp token file is created once and reused", () => {
  const dir = mkdtempSync(join(tmpdir(), "universe-token-"));
  const first = loadOrCreateDevMcpToken(dir);
  const second = loadOrCreateDevMcpToken(dir);
  assert.equal(first, second);
  assert.equal(first.length >= 32, true);
  assert.equal(readFileSync(join(dir, "dev-mcp-token"), "utf8"), first);
});

test("bearer parsing accepts only a bearer token", () => {
  assert.equal(bearerTokenOf({ authorization: "Bearer abc" }), "abc");
  assert.equal(bearerTokenOf({ authorization: "Basic abc" }), null);
  assert.equal(bearerTokenOf({}), null);
});

test("rpc handles initialize, tools/list and tools/call through the bridge", async () => {
  const init = await handleDevMcpRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, bridge);
  assert.equal(init.result.serverInfo.name, "UniVerse-Project-Browser");
  const list = await handleDevMcpRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, bridge);
  assert.equal(list.result.tools.some((t) => t.name === "list_tabs"), true);
  const call = await handleDevMcpRpc(
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_tabs", arguments: {} } },
    bridge,
  );
  assert.match(call.result.content[0].text, /Example/);
  const unknown = await handleDevMcpRpc({ jsonrpc: "2.0", id: 4, method: "bogus/method" }, bridge);
  assert.equal(unknown.error.code, -32601);
  const badTool = await handleDevMcpRpc(
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope", arguments: {} } },
    bridge,
  );
  assert.equal(badTool.result.isError, true);
});

test("the http server rejects missing tokens and serves rpc with a valid one", async () => {
  const handle = startDevMcpServer(bridge, { port: 0, token: "test-token-1234567890abcdef" });
  await new Promise((resolve) => setTimeout(resolve, 50));
  const port = handle.port;
  assert.notEqual(port, 0);
  const base = `http://127.0.0.1:${port}/mcp`;
  const denied = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  assert.equal(denied.status, 401);
  const allowed = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer test-token-1234567890abcdef" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
  });
  assert.equal(allowed.status, 200);
  const body = await allowed.json();
  assert.equal(body.result.tools.length > 0, true);
  const wrongPath = await fetch(`http://127.0.0.1:${port}/other`, { method: "POST" });
  assert.equal(wrongPath.status, 404);
  await handle.stop();
});
