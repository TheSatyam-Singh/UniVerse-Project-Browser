import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AppleIntelligenceProvider,
  GeminiProvider,
  OllamaProvider,
  OpenAICompatibleProvider,
  OpenRouterProvider,
  appleIntelligenceAvailable,
  estimateTokens,
  fetchOpenRouterModels,
  fittedToTokens,
} from "./providers.ts";
import { defaultGenerationConfig } from "./types.ts";

function stubFetch(handler) {
  return async (input, init) => {
    const result = await handler(input, init);
    return {
      status: result.status,
      json: async () => JSON.parse(result.body),
      text: async () => result.body,
    };
  };
}

const config = () => defaultGenerationConfig();
const noop = () => {};

test("gemini sends system instruction, contents and tools, then parses text, tool calls and usage", async () => {
  let seenUrl = "";
  let seenBody = null;
  const fetchFn = stubFetch(async (url, init) => {
    seenUrl = url;
    seenBody = JSON.parse(init.body);
    return {
      status: 200,
      body: JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                { text: "Hello [1](https://example.com)" },
                { functionCall: { name: "getTabList", args: {}, id: "call-1" }, thoughtSignature: "sig" },
              ],
            },
          },
        ],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4 },
      }),
    };
  });
  const provider = new GeminiProvider("key-123");
  const response = await provider.sendMessage({
    messages: [
      { role: "system", content: "Be brief." },
      { role: "user", content: "Hi" },
    ],
    model: "gemini-2.5-flash",
    config: config(),
    tools: [],
    onStream: noop,
    fetchFn,
  });
  assert.equal(seenUrl, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
  assert.equal(seenBody.system_instruction.parts[0].text, "Be brief.");
  assert.equal(seenBody.contents[0].role, "user");
  assert.equal(response.content, "Hello [1](https://example.com)");
  assert.equal(response.toolCalls[0].name, "getTabList");
  assert.equal(response.toolCalls[0].thoughtSignature, "sig");
  assert.equal(response.finishReason, "tool_calls");
  assert.equal(response.citations[0].url, "https://example.com");
  assert.equal(response.usage.totalTokens, 14);
});

test("gemini without a key fails before any request", async () => {
  let called = false;
  const fetchFn = stubFetch(async () => {
    called = true;
    return { status: 200, body: "{}" };
  });
  await assert.rejects(
    new GeminiProvider("").sendMessage({ messages: [], model: "m", config: config(), tools: [], onStream: noop, fetchFn }),
    /Invalid or missing API key/,
  );
  assert.equal(called, false);
});

test("gemini 429 surfaces as rate limited", async () => {
  const fetchFn = stubFetch(async () => ({ status: 429, body: "slow down" }));
  await assert.rejects(
    new GeminiProvider("k").sendMessage({ messages: [], model: "m", config: config(), tools: [], onStream: noop, fetchFn }),
    /Rate limit exceeded/,
  );
});

test("openrouter appends :online and web search options only when web search is on", async () => {
  let seenBody = null;
  const fetchFn = stubFetch(async (url, init) => {
    seenBody = JSON.parse(init.body);
    return {
      status: 200,
      body: JSON.stringify({
        choices: [{ message: { content: "ok", annotations: [] }, finish_reason: "stop" }],
        usage: { prompt_tokens: 3, completion_tokens: 2 },
      }),
    };
  });
  const provider = new OpenRouterProvider("or-key");
  const searching = defaultGenerationConfig({ webSearchEnabled: true, webSearchContextSize: "high" });
  const response = await provider.sendMessage({ messages: [{ role: "user", content: "q" }], model: "openai/gpt-4o", config: searching, tools: [], onStream: noop, fetchFn });
  assert.equal(seenBody.model, "openai/gpt-4o:online");
  assert.deepEqual(seenBody.web_search_options, { search_context_size: "high" });
  assert.equal(response.usage.totalTokens, 5);
  const plain = await provider.sendMessage({ messages: [{ role: "user", content: "q" }], model: "openai/gpt-4o", config: config(), tools: [], onStream: noop, fetchFn });
  assert.equal(seenBody.model, "openai/gpt-4o");
  assert.equal("web_search_options" in seenBody, false);
  assert.equal(plain.finishReason, "stop");
});

test("ollama posts to /api/chat and parses tool calls and token counts", async () => {
  let seenUrl = "";
  const fetchFn = stubFetch(async (url) => {
    seenUrl = url;
    return {
      status: 200,
      body: JSON.stringify({
        message: { content: "done", tool_calls: [{ function: { name: "createTab", arguments: { url: "https://example.com" } } }] },
        prompt_eval_count: 7,
        eval_count: 3,
      }),
    };
  });
  const provider = new OllamaProvider("http://localhost:11434");
  const response = await provider.sendMessage({ messages: [{ role: "user", content: "open example" }], model: "llama3.1", config: config(), tools: [], onStream: noop, fetchFn });
  assert.equal(seenUrl, "http://localhost:11434/api/chat");
  assert.equal(response.toolCalls[0].name, "createTab");
  assert.equal(response.toolCalls[0].arguments.url, "https://example.com");
  assert.equal(response.usage.totalTokens, 10);
});

test("openai-compatible rejects http for a remote host but allows localhost", async () => {
  const fetchFn = stubFetch(async () => ({ status: 200, body: JSON.stringify({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }) }));
  await assert.rejects(
    new OpenAICompatibleProvider("", "http://api.example.com/v1").sendMessage({ messages: [], model: "m", config: config(), tools: [], onStream: noop, fetchFn }),
    /must use HTTPS/,
  );
  const local = await new OpenAICompatibleProvider("", "http://localhost:1234/v1").sendMessage({
    messages: [{ role: "user", content: "hi" }],
    model: "m",
    config: config(),
    tools: [],
    onStream: noop,
    fetchFn,
  });
  assert.equal(local.content, "ok");
});

test("openai-compatible retries once, dropping max_tokens for reasoning models", async () => {
  const bodies = [];
  const fetchFn = stubFetch(async (url, init) => {
    bodies.push(JSON.parse(init.body));
    if (bodies.length === 1) {
      return { status: 400, body: JSON.stringify({ error: { param: "max_tokens", message: "unsupported" } }) };
    }
    return { status: 200, body: JSON.stringify({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }) };
  });
  const provider = new OpenAICompatibleProvider("k", "https://api.example.com/v1");
  await provider.sendMessage({ messages: [], model: "gpt-5", config: config(), tools: [], onStream: noop, fetchFn });
  assert.equal(bodies.length, 2);
  assert.equal("max_tokens" in bodies[0], true);
  assert.equal(bodies[1].max_completion_tokens, 4096);
  assert.equal("max_tokens" in bodies[1], false);
});

test("apple intelligence is gated off outside macOS 26 and its provider always throws", async () => {
  assert.equal(appleIntelligenceAvailable({ os: "win32", macOSMajor: 26, appleIntelligenceAvailable: true }), false);
  assert.equal(appleIntelligenceAvailable({ os: "darwin", macOSMajor: 25, appleIntelligenceAvailable: true }), false);
  assert.equal(appleIntelligenceAvailable({ os: "darwin", macOSMajor: 26, appleIntelligenceAvailable: true }), true);
  const provider = new AppleIntelligenceProvider({ os: "darwin", macOSMajor: 26 });
  assert.equal(provider.isAvailable(), true);
  await assert.rejects(provider.sendMessage({ messages: [], model: "apple-on-device", config: config(), tools: [], onStream: noop }), /macOS 26/);
});

test("openrouter model listing maps context and output limits", async () => {
  const fetchFn = stubFetch(async () => ({
    status: 200,
    body: JSON.stringify({
      data: [{ id: "a/b", name: "A B", context_length: 1000, top_provider: { max_completion_tokens: 55 } }],
    }),
  }));
  const models = await fetchOpenRouterModels("k", "https://openrouter.ai/api/v1", fetchFn);
  assert.deepEqual(models, [{ id: "a/b", displayName: "A B", contextWindow: 1000, maxOutput: 55 }]);
});

test("token helpers estimate 4 ascii chars per token and fit text to a budget", () => {
  assert.equal(estimateTokens("abcdefgh"), 2);
  assert.equal(fittedToTokens("abcdefghij", 2), "abcdefgh…");
  assert.equal(fittedToTokens("short", 10), "short");
});
