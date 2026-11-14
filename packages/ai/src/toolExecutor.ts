import { clickElementScript, extractStructuredDataScript, getInteractiveElementsScript, readPageContentScript, searchInPageScript, summarizePageScript, webUrl } from "./pageScripts.ts";
import { ALL_BROWSER_TOOL_NAMES, enabledToolDefinitions } from "./tools.ts";
import type { AIToolCall, AIToolDefinition, AIToolResult } from "./types.ts";

export type BridgeTab = {
  id: string;
  index: number;
  title: string;
  url: string;
  isActive: boolean;
};

export type PageBridge = {
  listTabs: () => BridgeTab[];
  activeTabId: () => string | null;
  activateTab: (tabId: string) => void;
  createTab: (url?: string) => string | null;
  navigateTab: (tabId: string, url: string) => void;
  evaluateJs: (tabId: string, code: string) => Promise<unknown>;
  evaluateJsWithArg?: (tabId: string, code: string, args: Record<string, unknown>) => Promise<unknown>;
  isPrivateWindow: () => boolean;
};

export type ConfirmationHandler = (toolName: string, args: Record<string, unknown>) => Promise<boolean>;

export type ToolExecutorOptions = {
  bridge: PageBridge | null;
  confirmationHandler?: ConfirmationHandler | null;
};

export function result(call: AIToolCall, content: string, isError = false): AIToolResult {
  return { toolCallId: call.id, toolName: call.name, content, isError };
}

function stringArg(args: Record<string, unknown>, key: string, fallback = ""): string {
  const value = args[key];
  return typeof value === "string" ? value : fallback;
}

function intArg(args: Record<string, unknown>, key: string, fallback: number): number {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
}

function boolArg(args: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = args[key];
  return typeof value === "boolean" ? value : fallback;
}

export class BrowserToolExecutor {
  private bridge: PageBridge | null;
  confirmationHandler: ConfirmationHandler | null;

  constructor({ bridge, confirmationHandler = null }: ToolExecutorOptions) {
    this.bridge = bridge;
    this.confirmationHandler = confirmationHandler;
  }

  setBridge(bridge: PageBridge | null): void {
    this.bridge = bridge;
  }

  availableToolDefinitions(enabledTools: Iterable<string>): AIToolDefinition[] {
    return enabledToolDefinitions(enabledTools);
  }

  async execute(call: AIToolCall): Promise<AIToolResult> {
    const bridge = this.bridge;
    if (!bridge) return result(call, "Browser not available", true);
    if (bridge.isPrivateWindow()) return result(call, "Tools are not available in a private window.", true);
    if (!ALL_BROWSER_TOOL_NAMES.includes(call.name)) return result(call, `Unknown tool: ${call.name}`, true);
    if (call.name === "executeJavaScript") {
      if (!this.confirmationHandler) {
        return result(call, "executeJavaScript requires user confirmation but no confirmation handler is available.", true);
      }
      const approved = await this.confirmationHandler(call.name, call.arguments);
      if (!approved) return result(call, "User denied execution of executeJavaScript.", true);
    }
    try {
      const content = await this.run(call, bridge);
      return result(call, content);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      return result(call, `Error: ${detail}`, true);
    }
  }

  private async run(call: AIToolCall, bridge: PageBridge): Promise<string> {
    const args = call.arguments;
    switch (call.name) {
      case "navigateToURL": {
        const url = webUrl(stringArg(args, "url"));
        if (!url) return "Invalid URL: only http and https URLs are allowed";
        const newTab = boolArg(args, "newTab", false);
        if (newTab) {
          bridge.createTab(url.toString());
        } else {
          const active = bridge.activeTabId();
          if (!active) return "No active tab";
          bridge.navigateTab(active, url.toString());
        }
        return `Navigated to ${url.toString()}${newTab ? " in new tab" : ""}`;
      }
      case "createTab": {
        const raw = stringArg(args, "url");
        if (raw) {
          const url = webUrl(raw);
          if (!url) return "Invalid URL: only http and https URLs are allowed";
          bridge.createTab(url.toString());
          return `Created new tab with URL: ${url.toString()}`;
        }
        bridge.createTab();
        return "Created new empty tab";
      }
      case "switchTab": {
        const index = intArg(args, "index", -1);
        const tabs = bridge.listTabs();
        if (tabs.length === 0) return "No tabs available";
        if (index < 0 || index >= tabs.length) return `Tab index ${index} out of range (0-${tabs.length - 1})`;
        const tab = tabs[index]!;
        bridge.activateTab(tab.id);
        return `Switched to tab: ${tab.title}`;
      }
      case "getTabList": {
        const tabs = bridge.listTabs();
        if (tabs.length === 0) return "No tabs available";
        return JSON.stringify(tabs, null, 2);
      }
      case "getSelectedText":
      case "readPageContent":
      case "clickElement":
      case "getInteractiveElements":
      case "extractStructuredData":
      case "summarizePage":
      case "searchInPage":
      case "executeJavaScript":
        return this.runPageTool(call, bridge);
      default:
        return `Unknown tool: ${call.name}`;
    }
  }

  private async runPageTool(call: AIToolCall, bridge: PageBridge): Promise<string> {
    const active = bridge.activeTabId();
    if (!active) return "No active tab";
    const args = call.arguments;
    switch (call.name) {
      case "readPageContent": {
        const maxLength = intArg(args, "maxLength", 8000);
        const selector = stringArg(args, "selector") || undefined;
        const data = await bridge.evaluateJs(active, readPageContentScript(maxLength, selector));
        if (data && typeof data === "object") {
          const page = data as { error?: string; title?: string; url?: string; content?: string };
          if (page.error) return `Error: ${page.error}`;
          return `Title: ${page.title ?? ""}\nURL: ${page.url ?? ""}\n\n${page.content ?? ""}`;
        }
        return "Failed to read page content";
      }
      case "clickElement": {
        const selector = stringArg(args, "selector") || undefined;
        const text = stringArg(args, "text") || undefined;
        if (!selector && !text) return "Provide either 'selector' (CSS) or 'text' (visible text) to identify the element";
        const out = await bridge.evaluateJs(active, clickElementScript(selector, text));
        return typeof out === "string" ? out : "Click executed";
      }
      case "getInteractiveElements": {
        const filter = stringArg(args, "filter");
        const limit = intArg(args, "limit", 50);
        const out = await bridge.evaluateJs(active, getInteractiveElementsScript(filter, limit));
        return typeof out === "string" ? out : "[]";
      }
      case "extractStructuredData": {
        const kind = stringArg(args, "type");
        if (!kind) return "Missing type parameter";
        const selectorsRaw = args.selectors;
        const selectors = Array.isArray(selectorsRaw) ? selectorsRaw.filter((s): s is string => typeof s === "string") : [];
        if (kind === "custom" && selectors.length === 0) return "Missing selectors for custom extraction";
        const script = extractStructuredDataScript(kind, selectors);
        if (!script) return `Unknown extraction type: ${kind}`;
        const out = await bridge.evaluateJs(active, script);
        return typeof out === "string" ? out : "No data found";
      }
      case "summarizePage": {
        const data = await bridge.evaluateJs(active, summarizePageScript());
        if (data && typeof data === "object") {
          const page = data as { title?: string; url?: string; content?: string };
          return `Title: ${page.title ?? ""}\nURL: ${page.url ?? ""}\n\n${page.content ?? ""}`;
        }
        return "Failed to read page";
      }
      case "searchInPage": {
        const query = stringArg(args, "query");
        if (!query) return "Missing query parameter";
        const runner = bridge.evaluateJsWithArg ?? bridge.evaluateJs;
        const out = await runner(active, searchInPageScript(), { query });
        return typeof out === "string" ? out : "No matches found";
      }
      case "getSelectedText": {
        const out = await bridge.evaluateJs(active, "window.getSelection().toString();");
        const text = typeof out === "string" ? out : "";
        return text ? text : "No text selected";
      }
      case "executeJavaScript": {
        const code = stringArg(args, "code");
        if (!code) return "Missing code parameter";
        const out = await bridge.evaluateJs(active, code);
        if (out === undefined || out === null) return "JavaScript executed (no return value)";
        return typeof out === "string" ? out : JSON.stringify(out);
      }
      default:
        return `Unknown tool: ${call.name}`;
    }
  }
}
