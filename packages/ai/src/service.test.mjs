import assert from "node:assert/strict";
import { test } from "node:test";
import { AIService } from "./service.ts";
import { defaultAIConfiguration } from "./config.ts";

function ollamaConfig() {
  const config = defaultAIConfiguration();
  config.activeProviderId = "ollama";
  config.activeModelId = "llama3.1";
  config.providers = config.providers.filter((p) => p.id === "ollama");
  return config;
}

function bridgeStub(overrides = {}) {
  return {
    listTabs: () => [
      { id: "tab-1", index: 0, title: "Example", url: "https://example.com", isActive: true },
      { id: "tab-2", index: 1, title: "Other", url: "https://other.com", isActive: false },
    ],
    activeTabId: () => "tab-1",
    activateTab: () => {},
    createTab: () => "tab-3",
    navigateTab: () => {},
    evaluateJs: async () => ({ title: "Example", url: "https://example.com", content: "page text", selection: "", truncated: false }),
    isPrivateWindow: () => false,
    ...overrides,
  };
}

function withFetch(responses, run) {
  const original = globalThis.fetch;
  let index = 0;
  globalThis.fetch = async () => {
    const body = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return { status: 200, json: async () => JSON.parse(body), text: async () => body };
  };
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

function ollamaReply(content, toolCalls = []) {
  const message = { content };
  if (toolCalls.length > 0) message.tool_calls = toolCalls;
  return JSON.stringify({ message, prompt_eval_count: 1, eval_count: 1 });
}

function makeService(overrides = {}) {
  const approvals = [];
  const service = new AIService({
    config: ollamaConfig(),
    apiKeyFor: () => "",
    platform: { os: "darwin", macOSMajor: 26 },
    bridge: bridgeStub(overrides.bridge ?? {}),
    mcpTools: () => [],
    callMcpTool: async () => "",
    requestApproval: async (request) => {
      approvals.push(request);
      return overrides.approval ?? "allow";
    },
    randomSuffix: () => "test1234",
    ...(overrides.service ?? {}),
  });
  return { service, approvals };
}

test("a plain reply lands in the conversation", async () => {
  const { service } = makeService();
  await withFetch([ollamaReply("Hello there")], () => service.sendMessage("Hi"));
  assert.equal(service.messages.length, 2);
  assert.equal(service.messages[1].content, "Hello there");
  assert.equal(service.isLoading, false);
});

test("a read-only tool runs without an approval prompt and its result reaches the model", async () => {
  const { service, approvals } = makeService();
  const first = ollamaReply("", [{ function: { name: "getTabList", arguments: {} } }]);
  await withFetch([first, ollamaReply("You have 2 tabs open")], () => service.sendMessage("What tabs are open?"));
  assert.deepEqual(approvals, []);
  assert.equal(service.messages.at(-1).content, "You have 2 tabs open");
});

test("a mutating tool asks first and a denial is reported back to the model", async () => {
  const { service, approvals } = makeService({ approval: "deny" });
  const first = ollamaReply("", [{ function: { name: "navigateToURL", arguments: { url: "https://example.com" } } }]);
  await withFetch([first, ollamaReply("I could not navigate.")], () => service.sendMessage("Go to example.com"));
  assert.equal(approvals.length, 1);
  assert.equal(approvals[0].toolName, "navigateToURL");
  assert.equal(approvals[0].offerAllowAll, true);
  assert.equal(service.messages.at(-1).content, "I could not navigate.");
});

test("allow all skips later prompts in the same chat", async () => {
  const { service, approvals } = makeService({ approval: "allowAll" });
  const first = ollamaReply("", [
    { function: { name: "createTab", arguments: { url: "https://example.com" } } },
    { function: { name: "switchTab", arguments: { index: 1 } } },
  ]);
  await withFetch([first, ollamaReply("Done")], () => service.sendMessage("Open example and switch to the second tab"));
  assert.equal(approvals.length, 1);
});

test("a private window gets no tools and no page context", async () => {
  const { service, approvals } = makeService({ bridge: { isPrivateWindow: () => true } });
  const seen = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    seen.push(JSON.parse(init.body));
    const body = ollamaReply("Private answer");
    return { status: 200, json: async () => JSON.parse(body), text: async () => body };
  };
  try {
    await service.sendMessage("What is on this page?");
  } finally {
    globalThis.fetch = original;
  }
  assert.deepEqual(approvals, []);
  assert.equal(seen[0].messages.at(-1).content, "What is on this page?");
  assert.equal("tools" in seen[0], false);
});

test("a failing provider surfaces an error message instead of throwing", async () => {
  const { service } = makeService();
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ status: 500, json: async () => ({}), text: async () => "boom" });
  try {
    await service.sendMessage("Hi");
  } finally {
    globalThis.fetch = original;
  }
  assert.match(service.messages.at(-1).content, /Sorry, I encountered an error/);
  assert.equal(service.isLoading, false);
});
