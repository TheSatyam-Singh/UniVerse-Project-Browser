export type AIProviderType = "gemini" | "openrouter" | "ollama" | "openai_compatible" | "apple_intelligence";

export const AI_PROVIDER_TYPES: readonly AIProviderType[] = ["gemini", "openrouter", "ollama", "openai_compatible", "apple_intelligence"];

export const AI_PROVIDER_DISPLAY_NAMES: Record<AIProviderType, string> = {
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  ollama: "Ollama (Local)",
  openai_compatible: "OpenAI Compatible",
  apple_intelligence: "Apple Intelligence",
};

export const AI_PROVIDER_REQUIRES_KEY: Record<AIProviderType, boolean> = {
  gemini: true,
  openrouter: true,
  ollama: false,
  openai_compatible: false,
  apple_intelligence: false,
};

export const AI_PROVIDER_DEFAULT_BASE_URL: Record<AIProviderType, string> = {
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  openrouter: "https://openrouter.ai/api/v1",
  ollama: "http://localhost:11434",
  openai_compatible: "",
  apple_intelligence: "",
};

export const APPLE_INTELLIGENCE_PROVIDER_ID = "apple-intelligence";
export const APPLE_INTELLIGENCE_MODEL_ID = "apple-on-device";
export const APPLE_INTELLIGENCE_MIN_MACOS = 26;

export type AIMessageRole = "system" | "user" | "assistant" | "tool";

export type AIToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  thoughtSignature?: string;
};

export type AIToolResult = {
  toolCallId: string;
  toolName: string;
  content: string;
  isError: boolean;
};

export type AIMessage = {
  role: AIMessageRole;
  content: string;
  toolCalls?: AIToolCall[];
  toolResults?: AIToolResult[];
};

export type AIFinishReason = "stop" | "tool_calls" | "max_tokens" | "error";

export type AIUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type URLCitation = {
  url: string;
  title?: string;
  content?: string;
  startIndex: number;
  endIndex: number;
};

export type AIResponse = {
  content: string;
  toolCalls: AIToolCall[];
  citations: URLCitation[];
  usage?: AIUsage;
  finishReason: AIFinishReason;
};

export type AIToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type AIModelCapabilities = {
  toolCalling: boolean;
  streaming: boolean;
  webSearch: boolean;
  contextWindow: number;
  maxOutput: number;
};

export type AIModelConfig = {
  id: string;
  displayName: string;
  providerId: string;
  isCustom: boolean;
  capabilities: AIModelCapabilities;
};

export type AIProviderConfig = {
  id: string;
  displayName: string;
  providerType: AIProviderType;
  baseURL: string;
  isEnabled: boolean;
  customHeaders: Record<string, string>;
};

export type AIGenerationConfig = {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  streamingEnabled: boolean;
  webSearchEnabled: boolean;
  webSearchEngine: string;
  webSearchMaxResults: number;
  webSearchContextSize: string;
};

export type BrowserToolExecutionMode = "auto" | "ask" | "disabled";

export const BROWSER_TOOL_EXECUTION_MODES: readonly BrowserToolExecutionMode[] = ["auto", "ask", "disabled"];

export type BrowserToolsConfig = {
  executionMode: BrowserToolExecutionMode;
  enabledTools: string[];
};

export type MCPTransportConfig = { kind: "stdio"; command: string; args: string[] } | { kind: "sse"; url: string };

export type MCPServerConfig = {
  id: string;
  name: string;
  transport: MCPTransportConfig;
  envVars: Record<string, string>;
  isEnabled: boolean;
};

export type MCPTool = {
  serverId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  qualifiedName?: string;
};

export type AIConfiguration = {
  providers: AIProviderConfig[];
  models: AIModelConfig[];
  activeProviderId?: string;
  activeModelId?: string;
  generationConfig: AIGenerationConfig;
  mcpServers: MCPServerConfig[];
  browserToolsConfig: BrowserToolsConfig;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  citations?: URLCitation[];
  usedWebSearch?: boolean;
};

export type PlatformInfo = {
  os: "darwin" | "win32" | "linux" | "android" | "ios" | "unknown";
  macOSMajor?: number;
  appleIntelligenceAvailable?: boolean;
};

export function defaultModelCapabilities(partial: Partial<AIModelCapabilities> = {}): AIModelCapabilities {
  return {
    toolCalling: false,
    streaming: true,
    webSearch: false,
    contextWindow: 128000,
    maxOutput: 4096,
    ...partial,
  };
}

export function defaultGenerationConfig(partial: Partial<AIGenerationConfig> = {}): AIGenerationConfig {
  return {
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    streamingEnabled: true,
    webSearchEnabled: false,
    webSearchEngine: "auto",
    webSearchMaxResults: 5,
    webSearchContextSize: "medium",
    ...partial,
  };
}

export const DEFAULT_SYSTEM_PROMPT = [
  "You are the assistant in UniVerse-Project-Browser, a web browser, shown in a narrow sidebar beside the page.",
  "",
  "The page the person is viewing arrives inside page_context tags: its title, URL and the first 8,000 characters of its text. Longer pages are cut off, so when the answer may be further down, use searchInPage or readPageContent before saying the page does not cover it.",
  "",
  "Answer the question asked, in the person's language, as briefly as it allows, and point to the part of the page you used. When the page does not say, tell them so. Never make up facts, figures or links. Short paragraphs and bullet lists read well in the sidebar; tables do not.",
  "",
  "When the person asks you to do something in the browser, do it with your tools rather than describing it. For a task with several steps, act, check the result with getInteractiveElements, and continue until it is done. Stop and ask before anything that spends money, sends a message, deletes data or submits a form for them.",
].join("\n");

export const APPLE_INTELLIGENCE_INSTRUCTIONS = [
  "You are the assistant in UniVerse-Project-Browser, a web browser, shown in a narrow sidebar beside the page. ",
  "Reply in the language the person writes in, as briefly as the question allows. ",
  "When the question is about the page, answer from the page text you are given, which may be cut off: ",
  "when the answer could be further down, use searchInPage before saying the page does not cover it, ",
  "and when the page does not say, tell them so. Answer other questions from your own knowledge. ",
  "Never make up facts, figures or links. Use a tool only when the person asks you to do something in the browser.",
].join("");

export function defaultProviderConfig(
  id: string,
  displayName: string,
  providerType: AIProviderType,
  baseURL?: string,
): AIProviderConfig {
  return {
    id,
    displayName,
    providerType,
    baseURL: baseURL ?? AI_PROVIDER_DEFAULT_BASE_URL[providerType],
    isEnabled: true,
    customHeaders: {},
  };
}

export function defaultBrowserToolsConfig(partial: Partial<BrowserToolsConfig> = {}): BrowserToolsConfig {
  return {
    executionMode: "ask",
    enabledTools: [],
    ...partial,
  };
}
