import { ALL_BROWSER_TOOL_NAMES } from "./tools.ts";
import type {
  AIConfiguration,
  AIModelConfig,
  AIProviderConfig,
  AIGenerationConfig,
  MCPServerConfig,
} from "./types.ts";
import {
  AI_PROVIDER_DEFAULT_BASE_URL,
  APPLE_INTELLIGENCE_MODEL_ID,
  APPLE_INTELLIGENCE_PROVIDER_ID,
  defaultBrowserToolsConfig,
  defaultGenerationConfig,
  defaultModelCapabilities,
  defaultProviderConfig,
} from "./types.ts";

export type AiKeyStore = {
  get: (providerId: string) => string;
  set: (providerId: string, apiKey: string) => void;
  delete: (providerId: string) => void;
  has: (providerId: string) => boolean;
};

export function createMemoryKeyStore(): AiKeyStore & { snapshotIds: () => string[] } {
  const keys = new Map<string, string>();
  return {
    get: (providerId) => keys.get(providerId) ?? "",
    set: (providerId, apiKey) => {
      if (!apiKey) keys.delete(providerId);
      else keys.set(providerId, apiKey);
    },
    delete: (providerId) => {
      keys.delete(providerId);
    },
    has: (providerId) => (keys.get(providerId) ?? "").length > 0,
    snapshotIds: () => [...keys.keys()],
  };
}

export function defaultAIConfiguration(): AIConfiguration {
  const gemini = defaultProviderConfig("gemini", "Google Gemini", "gemini");
  const openRouter = defaultProviderConfig("openrouter", "OpenRouter", "openrouter");
  const ollama = defaultProviderConfig("ollama", "Ollama (Local)", "ollama", "http://localhost:11434");
  const apple = defaultProviderConfig(APPLE_INTELLIGENCE_PROVIDER_ID, "Apple Intelligence", "apple_intelligence", "");
  const models: AIModelConfig[] = [
    {
      id: "gemini-2.5-flash",
      displayName: "Gemini 2.5 Flash",
      providerId: "gemini",
      isCustom: false,
      capabilities: defaultModelCapabilities({ toolCalling: true, webSearch: true }),
    },
    {
      id: APPLE_INTELLIGENCE_MODEL_ID,
      displayName: "On-Device",
      providerId: APPLE_INTELLIGENCE_PROVIDER_ID,
      isCustom: false,
      capabilities: defaultModelCapabilities({ toolCalling: true, contextWindow: 4096, maxOutput: 800 }),
    },
  ];
  return {
    providers: [apple, gemini, openRouter, ollama],
    models,
    activeProviderId: undefined,
    activeModelId: undefined,
    generationConfig: defaultGenerationConfig(),
    mcpServers: [],
    browserToolsConfig: defaultBrowserToolsConfig({ enabledTools: [...ALL_BROWSER_TOOL_NAMES] }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

function recordOfStrings(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) if (typeof v === "string") out[k] = v;
  return out;
}

function parseProvider(value: unknown): AIProviderConfig | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" && value.id ? value.id : null;
  const providerType = value.providerType;
  if (!id || typeof providerType !== "string") return null;
  if (!["gemini", "openrouter", "ollama", "openai_compatible", "apple_intelligence"].includes(providerType)) return null;
  const baseURL = typeof value.baseURL === "string" ? value.baseURL : AI_PROVIDER_DEFAULT_BASE_URL[providerType as keyof typeof AI_PROVIDER_DEFAULT_BASE_URL];
  return {
    id,
    displayName: typeof value.displayName === "string" ? value.displayName : id,
    providerType: providerType as AIProviderConfig["providerType"],
    baseURL,
    isEnabled: value.isEnabled !== false,
    customHeaders: recordOfStrings(value.customHeaders),
  };
}

function parseModel(value: unknown): AIModelConfig | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.providerId !== "string") return null;
  const caps = isRecord(value.capabilities) ? value.capabilities : {};
  return {
    id: value.id,
    displayName: typeof value.displayName === "string" ? value.displayName : value.id,
    providerId: value.providerId,
    isCustom: value.isCustom === true,
    capabilities: defaultModelCapabilities({
      toolCalling: caps.toolCalling === true,
      streaming: caps.streaming !== false,
      webSearch: caps.webSearch === true,
      contextWindow: typeof caps.contextWindow === "number" ? caps.contextWindow : 128000,
      maxOutput: typeof caps.maxOutput === "number" ? caps.maxOutput : 4096,
    }),
  };
}

function parseGeneration(value: unknown): AIGenerationConfig {
  const base = defaultGenerationConfig();
  if (!isRecord(value)) return base;
  return {
    temperature: typeof value.temperature === "number" ? value.temperature : base.temperature,
    maxTokens: typeof value.maxTokens === "number" ? Math.floor(value.maxTokens) : base.maxTokens,
    systemPrompt: typeof value.systemPrompt === "string" ? value.systemPrompt : base.systemPrompt,
    streamingEnabled: value.streamingEnabled !== false,
    webSearchEnabled: value.webSearchEnabled === true,
    webSearchEngine: typeof value.webSearchEngine === "string" ? value.webSearchEngine : base.webSearchEngine,
    webSearchMaxResults: typeof value.webSearchMaxResults === "number" ? Math.floor(value.webSearchMaxResults) : base.webSearchMaxResults,
    webSearchContextSize: typeof value.webSearchContextSize === "string" ? value.webSearchContextSize : base.webSearchContextSize,
  };
}

function parseMcpServer(value: unknown): MCPServerConfig | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string") return null;
  const transport = isRecord(value.transport) ? value.transport : null;
  if (!transport) return null;
  if (transport.kind === "stdio" && typeof transport.command === "string") {
    return {
      id: value.id,
      name: value.name,
      transport: { kind: "stdio", command: transport.command, args: stringList(transport.args) },
      envVars: recordOfStrings(value.envVars),
      isEnabled: value.isEnabled !== false,
    };
  }
  if (transport.kind === "sse" && typeof transport.url === "string") {
    return {
      id: value.id,
      name: value.name,
      transport: { kind: "sse", url: transport.url },
      envVars: recordOfStrings(value.envVars),
      isEnabled: value.isEnabled !== false,
    };
  }
  return null;
}

export function parseAIConfiguration(value: unknown): AIConfiguration {
  const defaults = defaultAIConfiguration();
  if (!isRecord(value)) return defaults;
  const providers = Array.isArray(value.providers) ? value.providers.map(parseProvider).filter((p): p is AIProviderConfig => p !== null) : [];
  const models = Array.isArray(value.models) ? value.models.map(parseModel).filter((m): m is AIModelConfig => m !== null) : [];
  const mcpServers = Array.isArray(value.mcpServers) ? value.mcpServers.map(parseMcpServer).filter((s): s is MCPServerConfig => s !== null) : [];
  const toolsRaw = isRecord(value.browserToolsConfig) ? value.browserToolsConfig : {};
  const enabledTools = stringList(toolsRaw.enabledTools).filter((name) => ALL_BROWSER_TOOL_NAMES.includes(name));
  const executionMode = toolsRaw.executionMode === "auto" || toolsRaw.executionMode === "ask" || toolsRaw.executionMode === "disabled" ? toolsRaw.executionMode : "ask";
  return {
    providers: providers.length > 0 ? providers : defaults.providers,
    models,
    activeProviderId: typeof value.activeProviderId === "string" ? value.activeProviderId : undefined,
    activeModelId: typeof value.activeModelId === "string" ? value.activeModelId : undefined,
    generationConfig: parseGeneration(value.generationConfig),
    mcpServers,
    browserToolsConfig: { executionMode, enabledTools },
  };
}

export function setActiveProvider(config: AIConfiguration, providerId: string): AIConfiguration {
  const next: AIConfiguration = { ...config, activeProviderId: providerId, activeModelId: undefined };
  const firstModel = config.models.find((m) => m.providerId === providerId);
  if (firstModel) next.activeModelId = firstModel.id;
  return next;
}

export function modelsForProvider(config: AIConfiguration, providerId: string): AIModelConfig[] {
  return config.models.filter((m) => m.providerId === providerId);
}

export function addCustomProvider(config: AIConfiguration, name: string, baseURL: string): AIConfiguration {
  const provider = defaultProviderConfig(`custom-${Date.now().toString(36)}`, name, "openai_compatible", baseURL);
  return { ...config, providers: [...config.providers, provider] };
}

export function removeProvider(config: AIConfiguration, providerId: string, keyStore: AiKeyStore): AIConfiguration {
  keyStore.delete(providerId);
  const providers = config.providers.filter((p) => p.id !== providerId);
  const models = config.models.filter((m) => m.providerId !== providerId);
  const activeProviderId = config.activeProviderId === providerId ? providers[0]?.id : config.activeProviderId;
  const activeModelId = config.activeModelId && models.some((m) => m.id === config.activeModelId) ? config.activeModelId : models.find((m) => m.providerId === activeProviderId)?.id;
  return { ...config, providers, models, activeProviderId, activeModelId };
}

export function addMcpServer(config: AIConfiguration, server: MCPServerConfig): AIConfiguration {
  return { ...config, mcpServers: [...config.mcpServers, server] };
}

export function removeMcpServer(config: AIConfiguration, serverId: string): AIConfiguration {
  return { ...config, mcpServers: config.mcpServers.filter((s) => s.id !== serverId) };
}

export function stripSecretsFromConfig(config: AIConfiguration): AIConfiguration {
  return JSON.parse(JSON.stringify(config)) as AIConfiguration;
}

export function configContainsKey(value: unknown): boolean {
  if (typeof value === "string") return /api[_-]?key|secret|token/i.test(value);
  if (Array.isArray(value)) return value.some(configContainsKey);
  if (isRecord(value)) return Object.entries(value).some(([k, v]) => /api[_-]?key|secret|token|password/i.test(k) || configContainsKey(v));
  return false;
}
