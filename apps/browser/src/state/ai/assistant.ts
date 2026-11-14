import {
  AIService,
  MCPManager,
  defaultAIConfiguration,
  type AIConfiguration,
  type ApprovalDecision,
  type MCPServerConfig,
} from "@universe/ai";
import { create } from "zustand";
import type { Settings } from "../settings/settings";
import { useBrowser } from "../browser/store";
import { buildPageBridge } from "./aiBridge";
import { getAiApiKey } from "./keyStore";

export type AssistantApproval = {
  toolName: string;
  args: Record<string, unknown>;
  mcpServerId?: string;
  offerAllowAll: boolean;
};

type AssistantState = {
  assistantOpen: boolean;
  messages: { role: "user" | "assistant"; content: string; timestamp: number }[];
  isLoading: boolean;
  streamingText: string;
  isExecutingTools: boolean;
  currentToolName: string | null;
  pendingApproval: AssistantApproval | null;
  config: AIConfiguration;
  error: string | null;
};

let approvalResolve: ((decision: ApprovalDecision) => void) | null = null;
let mcpManager: MCPManager | null = null;
let service: AIService | null = null;

export function configFromSettings(settings: Settings, base?: AIConfiguration): AIConfiguration {
  const config = base ?? defaultAIConfiguration();
  const settingsProviderId = settings.aiProvider === "apple_intelligence" ? "apple-intelligence" : settings.aiProvider;
  const providerId = config.providers.some((p) => p.id === settingsProviderId) ? settingsProviderId : config.activeProviderId;
  const ollama = config.providers.find((p) => p.id === "ollama");
  const providers = ollama && ollama.baseURL !== settings.ollamaEndpoint ? config.providers.map((p) => (p.id === "ollama" ? { ...p, baseURL: settings.ollamaEndpoint } : p)) : config.providers;
  return {
    ...config,
    providers,
    activeProviderId: providerId,
    activeModelId: settings.aiModel || config.activeModelId,
    generationConfig: {
      ...config.generationConfig,
      webSearchEnabled: settings.aiWebSearchEnabled,
      webSearchEngine: settings.aiWebSearchEngine,
      webSearchMaxResults: settings.aiWebSearchMaxResults,
      webSearchContextSize: settings.aiWebSearchContextSize,
    },
    browserToolsConfig: { ...config.browserToolsConfig, executionMode: settings.aiToolExecutionMode },
  };
}

function platformInfo(): { os: "darwin" | "win32" | "linux" | "android" | "ios" | "unknown"; macOSMajor?: number; appleIntelligenceAvailable?: boolean } {
  return { os: "darwin" };
}

function buildService(config: AIConfiguration): AIService {
  if (!mcpManager) mcpManager = new MCPManager();
  const manager = mcpManager;
  return new AIService({
    config,
    apiKeyFor: (providerId) => getAiApiKey(providerId),
    platform: platformInfo(),
    bridge: buildPageBridge(),
    mcpTools: () => manager.allTools,
    callMcpTool: (serverId, name, args) => manager.callTool(serverId, name, args),
    requestApproval: (request) => {
      useAssistant.setState({ pendingApproval: request });
      return new Promise<ApprovalDecision>((resolve) => {
        approvalResolve = resolve;
      });
    },
  });
}

export const useAssistant = create<AssistantState>()(() => ({
  assistantOpen: false,
  messages: [],
  isLoading: false,
  streamingText: "",
  isExecutingTools: false,
  currentToolName: null,
  pendingApproval: null,
  config: defaultAIConfiguration(),
  error: null,
}));

export function toggleAssistantOpen(): void {
  useAssistant.setState((s) => ({ assistantOpen: !s.assistantOpen }));
}

export function resolveAssistantApproval(decision: ApprovalDecision): void {
  useAssistant.setState({ pendingApproval: null });
  approvalResolve?.(decision);
  approvalResolve = null;
}

export function clearAssistantMessages(): void {
  service?.clearMessages();
  useAssistant.setState({ messages: [], streamingText: "", error: null });
}

export function setAssistantConfig(patch: Partial<AIConfiguration>): void {
  const current = useAssistant.getState().config;
  const next = { ...current, ...patch };
  useAssistant.setState({ config: next });
  service?.updateConfig(next);
}

export function addAssistantMcpServer(server: MCPServerConfig): void {
  const config = useAssistant.getState().config;
  setAssistantConfig({ mcpServers: [...config.mcpServers, server] });
  mcpManager?.connectServer(server);
}

export function removeAssistantMcpServer(serverId: string): void {
  const config = useAssistant.getState().config;
  setAssistantConfig({ mcpServers: config.mcpServers.filter((s) => s.id !== serverId) });
  void mcpManager?.disconnectServer(serverId);
}

export function startAssistantMcpServers(): void {
  const config = useAssistant.getState().config;
  if (!mcpManager) mcpManager = new MCPManager();
  mcpManager.startEnabledServers(config.mcpServers);
}

export async function sendAssistantMessage(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const settings = useBrowser.getState().settings;
  const config = configFromSettings(settings, useAssistant.getState().config);
  useAssistant.setState({ config });
  if (!service) service = buildService(config);
  else service.updateConfig(config);
  const active = service;
  useAssistant.setState({ isLoading: true, error: null });
  const sync = () => {
    useAssistant.setState({
      messages: active.messages,
      streamingText: active.streamingText,
      isExecutingTools: active.isExecutingTools,
      currentToolName: active.currentToolName,
      isLoading: active.isLoading,
    });
  };
  const timer = setInterval(sync, 120);
  try {
    await active.sendMessage(trimmed);
  } finally {
    clearInterval(timer);
    sync();
  }
}
