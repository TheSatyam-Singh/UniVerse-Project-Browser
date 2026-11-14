import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_BROWSER_TOOLS, ALL_BROWSER_TOOL_NAMES, MUTATING_TOOLS, READ_ONLY_TOOLS, enabledToolDefinitions, toGeminiFormat, toOpenAIFormat } from "./tools.ts";

test("all twelve browser tools from Nook are defined", () => {
  assert.deepEqual(
    [...ALL_BROWSER_TOOL_NAMES].sort(),
    [
      "clickElement",
      "createTab",
      "executeJavaScript",
      "extractStructuredData",
      "getInteractiveElements",
      "getSelectedText",
      "getTabList",
      "navigateToURL",
      "readPageContent",
      "searchInPage",
      "summarizePage",
      "switchTab",
    ].sort(),
  );
  assert.equal(ALL_BROWSER_TOOLS.length, 12);
});

test("read-only tools auto-run in ask mode and mutating tools prompt", () => {
  for (const name of ["readPageContent", "getTabList", "getInteractiveElements", "extractStructuredData", "summarizePage", "searchInPage", "getSelectedText"]) {
    assert.equal(READ_ONLY_TOOLS.has(name), true, name);
  }
  for (const name of ["executeJavaScript", "navigateToURL", "clickElement", "createTab", "switchTab"]) {
    assert.equal(MUTATING_TOOLS.has(name), true, name);
    assert.equal(READ_ONLY_TOOLS.has(name), false, name);
  }
});

test("enabled tools filter by name", () => {
  const defs = enabledToolDefinitions(["getTabList", "createTab"]);
  assert.deepEqual(
    defs.map((d) => d.name),
    ["getTabList", "createTab"],
  );
});

test("tool formats match the Gemini and OpenAI shapes", () => {
  const def = ALL_BROWSER_TOOLS.find((t) => t.name === "navigateToURL");
  assert.deepEqual(toGeminiFormat(def), { name: "navigateToURL", description: def.description, parameters: def.parameters });
  assert.deepEqual(toOpenAIFormat(def), {
    type: "function",
    function: { name: "navigateToURL", description: def.description, parameters: def.parameters },
  });
});
