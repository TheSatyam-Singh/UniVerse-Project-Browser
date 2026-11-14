import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addCustomProvider,
  createMemoryKeyStore,
  defaultAIConfiguration,
  parseAIConfiguration,
  removeProvider,
  setActiveProvider,
} from "./config.ts";

test("defaults list apple intelligence first and enable every browser tool in ask mode", () => {
  const config = defaultAIConfiguration();
  assert.equal(config.providers[0].id, "apple-intelligence");
  assert.equal(config.browserToolsConfig.executionMode, "ask");
  assert.equal(config.browserToolsConfig.enabledTools.length, 12);
  assert.equal(config.generationConfig.webSearchEnabled, false);
  assert.equal(config.activeProviderId, undefined);
});

test("parsing drops api keys from saved data and repairs bad values", () => {
  const config = parseAIConfiguration({
    apiKey: "should-not-be-here",
    providers: [{ id: "gemini", displayName: "Gemini", providerType: "gemini", baseURL: "https://x", isEnabled: true, customHeaders: {}, apiKey: "also-no" }],
    browserToolsConfig: { executionMode: "always", enabledTools: ["getTabList", "notATool"] },
  });
  assert.equal("apiKey" in config, false);
  assert.equal("apiKey" in config.providers[0], false);
  assert.equal(config.browserToolsConfig.executionMode, "ask");
  assert.deepEqual(config.browserToolsConfig.enabledTools, ["getTabList"]);
});

test("setActiveProvider auto-selects the provider's first model", () => {
  const config = setActiveProvider(defaultAIConfiguration(), "gemini");
  assert.equal(config.activeProviderId, "gemini");
  assert.equal(config.activeModelId, "gemini-2.5-flash");
});

test("removing a provider deletes its key and moves the active provider", () => {
  const keys = createMemoryKeyStore();
  keys.set("gemini", "secret-key");
  let config = setActiveProvider(defaultAIConfiguration(), "gemini");
  config = removeProvider(config, "gemini", keys);
  assert.equal(keys.has("gemini"), false);
  assert.equal(config.providers.some((p) => p.id === "gemini"), false);
  assert.notEqual(config.activeProviderId, "gemini");
  assert.equal(config.models.some((m) => m.providerId === "gemini"), false);
});

test("memory key store holds keys only for the session and never serialises them", () => {
  const keys = createMemoryKeyStore();
  keys.set("openrouter", "or-key");
  assert.equal(keys.get("openrouter"), "or-key");
  assert.equal(JSON.stringify(keys).includes("or-key"), false);
  keys.set("openrouter", "");
  assert.equal(keys.has("openrouter"), false);
});

test("custom providers are openai-compatible and keep their base url", () => {
  const config = addCustomProvider(defaultAIConfiguration(), "Groq", "https://api.groq.com/openai/v1");
  const added = config.providers.at(-1);
  assert.equal(added.providerType, "openai_compatible");
  assert.equal(added.baseURL, "https://api.groq.com/openai/v1");
});
