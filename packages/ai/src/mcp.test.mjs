import assert from "node:assert/strict";
import { test } from "node:test";
import { MCPClient, MCPManager, MCPToolFunctionRegistry, buildNotification, buildRequest, createSseTransport, isLocalOrHttps } from "./mcp.ts";

const serverConfig = (id = "srv-1") => ({
  id,
  name: "Test Server",
  transport: { kind: "stdio", command: "/bin/true", args: [] },
  envVars: {},
  isEnabled: true,
});

function fakeTransportFactory(responses) {
  return () => {
    let handler = null;
    return {
      async send(data) {
        const parsed = JSON.parse(data);
        if (parsed.id === -1 || parsed.id === undefined) return;
        const response = responses[parsed.method];
        if (!response) return;
        queueMicrotask(() => handler?.(JSON.stringify({ jsonrpc: "2.0", id: parsed.id, result: response })));
      },
      onMessage(next) {
        handler = next;
      },
      async close() {},
    };
  };
}

test("json-rpc builders produce requests with ids and notifications without them", () => {
  assert.deepEqual(buildRequest(3, "tools/list"), { jsonrpc: "2.0", id: 3, method: "tools/list" });
  assert.deepEqual(buildNotification("notifications/initialized"), { jsonrpc: "2.0", method: "notifications/initialized" });
});

test("sse transport requires https off localhost", () => {
  assert.equal(isLocalOrHttps("http://localhost:8000/sse"), true);
  assert.equal(isLocalOrHttps("https://example.com/sse"), true);
  assert.equal(isLocalOrHttps("http://example.com/sse"), false);
  assert.throws(() => createSseTransport("http://example.com/sse", async () => ({ status: 200, text: async () => "" })), /HTTPS/);
});

test("function registry renames colliding mcp tools instead of overwriting them", () => {
  const registry = new MCPToolFunctionRegistry();
  const taken = new Set(["getTabList"]);
  const first = registry.register({ serverId: "a", name: "read", description: "", inputSchema: {} }, taken);
  const second = registry.register({ serverId: "b", name: "read", description: "", inputSchema: {} }, taken);
  assert.equal(first, "read");
  assert.notEqual(second, "read");
  assert.equal(registry.tools.get(second).qualifiedName, "b/read");
});

test("client initialises, lists tools and calls one, concatenating text parts", async () => {
  const client = new MCPClient(
    serverConfig(),
    fakeTransportFactory({
      initialize: { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: { name: "t", version: "1" } },
      "tools/list": { tools: [{ name: "echo", description: "Echoes", inputSchema: { type: "object", properties: {} } }] },
      "tools/call": { content: [{ type: "text", text: "hello" }, { type: "text", text: "world" }] },
    }),
  );
  await client.connect();
  assert.equal(client.connectionState, "connected");
  assert.deepEqual(
    client.discoveredTools.map((t) => t.name),
    ["echo"],
  );
  assert.equal(await client.callTool("echo", { text: "hi" }), "hello\nworld");
  await client.disconnect();
  assert.equal(client.connectionState, "disconnected");
  assert.deepEqual(client.discoveredTools, []);
});

test("client reports a failed connect as an error state", async () => {
  const client = new MCPClient(serverConfig(), () => {
    throw new Error("spawn failed");
  });
  await assert.rejects(client.connect(), /spawn failed/);
  assert.equal(client.connectionState.error, "spawn failed");
});

test("manager aggregates tools across connected servers and drops them on disconnect", async () => {
  const factory = (config) =>
    new MCPClient(
      config,
      fakeTransportFactory({
        initialize: {},
        "tools/list": { tools: [{ name: `tool-${config.id}`, description: "", inputSchema: {} }] },
        "tools/call": { content: [{ type: "text", text: "ok" }] },
      }),
    );
  const manager = new MCPManager(factory);
  manager.connectServer(serverConfig("srv-1"));
  manager.connectServer(serverConfig("srv-2"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(manager.hasConnectedServers, true);
  assert.equal(manager.allTools.length, 2);
  assert.equal(await manager.callTool("srv-1", "tool-srv-1", {}), "ok");
  await manager.disconnectServer("srv-1");
  assert.equal(manager.allTools.length, 1);
  await manager.stopAll();
  assert.equal(manager.hasConnectedServers, false);
});
