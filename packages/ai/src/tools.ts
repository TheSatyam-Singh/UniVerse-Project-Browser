import type { AIToolDefinition } from "./types.ts";

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[] = []): AIToolDefinition {
  return { name, description, parameters: { type: "object", properties, required } };
}

export const BROWSER_TOOLS: Record<string, AIToolDefinition> = {
  navigateToURL: tool(
    "navigateToURL",
    "Navigate the current tab to a URL, or open a new tab with the URL",
    {
      url: { type: "string", description: "The URL to navigate to" },
      newTab: { type: "boolean", description: "Whether to open in a new tab (default: false)" },
    },
    ["url"],
  ),
  readPageContent: tool(
    "readPageContent",
    "Read the text content of the current page, including title, URL, and body text",
    {
      maxLength: { type: "integer", description: "Maximum character length to return (default: 8000)" },
      selector: { type: "string", description: "Optional CSS selector to read content from a specific element" },
    },
  ),
  clickElement: tool(
    "clickElement",
    "Click an element on the page. Provide EITHER a CSS selector OR the visible text of the element to click. When using text, it finds buttons, links, and inputs whose visible text contains your query.",
    {
      selector: { type: "string", description: "CSS selector for the element to click" },
      text: { type: "string", description: "Visible text of the element to click (searches buttons, links, inputs, [role=button])" },
    },
  ),
  getInteractiveElements: tool(
    "getInteractiveElements",
    "Get all interactive elements on the page (buttons, links, inputs, selects) with their text, type, selector, and attributes. Essential before clicking — use this to see what you can interact with.",
    {
      filter: { type: "string", description: "Optional text filter to narrow results (case-insensitive match on text/aria-label/placeholder)" },
      limit: { type: "integer", description: "Maximum number of elements to return (default: 50)" },
    },
  ),
  extractStructuredData: tool(
    "extractStructuredData",
    "Extract structured data from the page (schema.org, Open Graph, meta tags, or custom selectors)",
    {
      type: { type: "string", enum: ["schema_org", "open_graph", "meta", "custom"], description: "Type of data to extract" },
      selectors: { type: "array", items: { type: "string" }, description: "CSS selectors for custom extraction" },
    },
    ["type"],
  ),
  summarizePage: tool("summarizePage", "Get the full text content of the page for summarization", {}),
  searchInPage: tool(
    "searchInPage",
    "Search for text on the current page and return matches with surrounding context",
    { query: { type: "string", description: "Text to search for on the page" } },
    ["query"],
  ),
  getTabList: tool("getTabList", "Get a list of all open tabs with their titles and URLs", {}),
  switchTab: tool(
    "switchTab",
    "Switch to a tab by its index (0-based) from the tab list",
    { index: { type: "integer", description: "Index of the tab to switch to" } },
    ["index"],
  ),
  createTab: tool("createTab", "Create a new tab, optionally with a URL", {
    url: { type: "string", description: "Optional URL to load in the new tab" },
  }),
  getSelectedText: tool("getSelectedText", "Get the currently selected text on the page", {}),
  executeJavaScript: tool(
    "executeJavaScript",
    "Execute arbitrary JavaScript on the current page. Use with caution.",
    { code: { type: "string", description: "JavaScript code to execute" } },
    ["code"],
  ),
};

export const ALL_BROWSER_TOOLS: AIToolDefinition[] = Object.values(BROWSER_TOOLS);

export const ALL_BROWSER_TOOL_NAMES: string[] = ALL_BROWSER_TOOLS.map((t) => t.name);

export const READ_ONLY_TOOLS: ReadonlySet<string> = new Set([
  "readPageContent",
  "getTabList",
  "getInteractiveElements",
  "extractStructuredData",
  "summarizePage",
  "searchInPage",
  "getSelectedText",
]);

export const MUTATING_TOOLS: ReadonlySet<string> = new Set([
  "executeJavaScript",
  "navigateToURL",
  "clickElement",
  "createTab",
  "switchTab",
]);

export function toGeminiFormat(def: AIToolDefinition): Record<string, unknown> {
  return { name: def.name, description: def.description, parameters: def.parameters };
}

export function toOpenAIFormat(def: AIToolDefinition): Record<string, unknown> {
  return { type: "function", function: { name: def.name, description: def.description, parameters: def.parameters } };
}

export function enabledToolDefinitions(enabledTools: Iterable<string>): AIToolDefinition[] {
  const enabled = new Set(enabledTools);
  return ALL_BROWSER_TOOLS.filter((t) => enabled.has(t.name));
}
