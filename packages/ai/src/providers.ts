import { httpError, invalidApiKey, invalidResponse, insecureUrl, networkError, requireHttpsForRemote, unsupportedFeature } from "./errors.ts";
import { toOpenAIFormat } from "./tools.ts";
import { asInt, asList, asRecord, asString, defaultFetch, getJson, isRecord, postJson, type FetchFn, type JsonRecord } from "./providerUtils.ts";
import { GeminiProvider } from "./providersGemini.ts";
import { OllamaProvider } from "./providersOllama.ts";
import { AppleIntelligenceProvider, type OnDeviceToolRunner } from "./providersApple.ts";
import type {
  AIGenerationConfig,
  AIMessage,
  AIProviderConfig,
  AIResponse,
  AIToolCall,
  AIToolDefinition,
  AIUsage,
  PlatformInfo,
  URLCitation,
} from "./types.ts";
import { AI_PROVIDER_DEFAULT_BASE_URL } from "./types.ts";

export { GeminiProvider, parseInlineCitations } from "./providersGemini.ts";
export { OllamaProvider } from "./providersOllama.ts";
export { AppleIntelligenceProvider, appleIntelligenceAvailable, appleIntelligenceUnavailableNote, estimateTokens, fittedToTokens, type OnDeviceToolRunner } from "./providersApple.ts";
export type { FetchFn } from "./providerUtils.ts";

export type StreamCallback = (textSoFar: string) => void;

export type ProviderSendArgs = {
  messages: AIMessage[];
  model: string;
  config: AIGenerationConfig;
  tools: AIToolDefinition[];
  onStream: StreamCallback;
  fetchFn?: FetchFn;
};

export type AIProvider = {
  readonly providerId: string;
  sendMessage: (args: ProviderSendArgs) => Promise<AIResponse>;
};


function openAIMessages(messages: AIMessage[]): JsonRecord[] {
  const out: JsonRecord[] = [];
  for (const message of messages) {
    if (message.role === "system" || message.role === "user") {
      out.push({ role: message.role, content: message.content });
    } else if (message.role === "assistant") {
      if (message.toolCalls && message.toolCalls.length > 0) {
        const msg: JsonRecord = { role: "assistant" };
        if (message.content) msg.content = message.content;
        msg.tool_calls = message.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.arguments) },
        }));
        out.push(msg);
      } else {
        out.push({ role: "assistant", content: message.content });
      }
    } else if (message.role === "tool") {
      for (const result of message.toolResults ?? []) {
        out.push({ role: "tool", tool_call_id: result.toolCallId, content: result.content });
      }
    }
  }
  return out;
}

function parseOpenAIToolCalls(message: JsonRecord): AIToolCall[] {
  const calls: AIToolCall[] = [];
  for (const entry of asList(message.tool_calls)) {
    const item = asRecord(entry);
    const fn = asRecord(item.function);
    const id = asString(item.id);
    const name = asString(fn.name);
    if (!id || !name) continue;
    let args: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(asString(fn.arguments) || "{}");
      if (isRecord(parsed)) args = parsed;
    } catch {
      args = {};
    }
    calls.push({ id, name, arguments: args });
  }
  return calls;
}

function parseOpenAIResponse(data: unknown): AIResponse {
  const root = asRecord(data);
  const choices = asList(root.choices);
  const first = asRecord(choices[0]);
  const message = asRecord(first.message);
  const content = asString(message.content);
  const toolCalls = parseOpenAIToolCalls(message);
  const finishRaw = asString(first.finish_reason) || "stop";
  const finishReason = finishRaw === "tool_calls" ? "tool_calls" : finishRaw === "length" ? "max_tokens" : toolCalls.length > 0 ? "tool_calls" : "stop";
  let usage: AIUsage | undefined;
  const usageData = asRecord(root.usage);
  if (typeof usageData.prompt_tokens === "number") {
    const prompt = asInt(usageData.prompt_tokens);
    const completion = asInt(usageData.completion_tokens);
    usage = { promptTokens: prompt, completionTokens: completion, totalTokens: prompt + completion };
  }
  return { content, toolCalls, citations: parseOpenAIAnnotations(message), usage, finishReason };
}

function parseOpenAIAnnotations(message: JsonRecord): URLCitation[] {
  const citations: URLCitation[] = [];
  for (const entry of asList(message.annotations)) {
    const item = asRecord(entry);
    if (item.type !== "url_citation") continue;
    const cited = asRecord(item.url_citation);
    const url = asString(cited.url);
    if (!url) continue;
    citations.push({
      url,
      title: typeof cited.title === "string" ? cited.title : undefined,
      content: typeof cited.content === "string" ? cited.content : undefined,
      startIndex: asInt(cited.start_index),
      endIndex: asInt(cited.end_index),
    });
  }
  return citations;
}

function fixOpenAIRejection(body: JsonRecord, data: unknown): JsonRecord | null {
  const root = asRecord(data);
  const error = asRecord(root.error);
  const param = asString(error.param);
  const next: JsonRecord = { ...body };
  if (param === "max_tokens") {
    if (!("max_tokens" in next)) return null;
    const limit = next.max_tokens;
    delete next.max_tokens;
    next.max_completion_tokens = limit;
    return next;
  }
  if (param === "temperature") {
    if (!("temperature" in next)) return null;
    delete next.temperature;
    return next;
  }
  return null;
}

async function sendOpenAIChatCompletions(
  url: string,
  headers: Record<string, string>,
  body: JsonRecord,
  fetchFn: FetchFn,
): Promise<AIResponse> {
  let current = body;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { status, json, text } = await postJson(url, current, headers, fetchFn);
    if (status === 400) {
      const fixed = fixOpenAIRejection(current, json);
      if (fixed) {
        current = fixed;
        continue;
      }
    }
    if (status !== 200) throw httpError(status, text);
    return parseOpenAIResponse(json);
  }
  throw invalidResponse("provider kept rejecting the request body");
}

export class OpenRouterProvider implements AIProvider {
  readonly providerId = "openrouter";
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string = AI_PROVIDER_DEFAULT_BASE_URL.openrouter) {
    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/$/, "");
  }

  async sendMessage({ messages, model, config, tools, onStream, fetchFn }: ProviderSendArgs): Promise<AIResponse> {
    if (!this.apiKey) throw invalidApiKey();
    const effectiveModel = config.webSearchEnabled ? `${model}:online` : model;
    const body: JsonRecord = {
      model: effectiveModel,
      messages: openAIMessages(messages),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    };
    if (tools.length > 0) body.tools = tools.map(toOpenAIFormat);
    if (config.webSearchEnabled) body.web_search_options = { search_context_size: config.webSearchContextSize };
    const response = await sendOpenAIChatCompletions(
      `${this.baseURL}/chat/completions`,
      { Authorization: `Bearer ${this.apiKey}` },
      body,
      fetchFn ?? defaultFetch(),
    );
    onStream(response.content);
    return response;
  }
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly providerId = "openai_compatible";
  private apiKey: string;
  private baseURL: string;
  private customHeaders: Record<string, string>;

  constructor(apiKey: string, baseURL: string, customHeaders: Record<string, string> = {}) {
    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/$/, "");
    this.customHeaders = customHeaders;
  }

  async sendMessage({ messages, model, config, tools, onStream, fetchFn }: ProviderSendArgs): Promise<AIResponse> {
    if (!this.baseURL) throw invalidApiKey();
    requireHttpsForRemote(this.baseURL);
    const headers: Record<string, string> = { ...this.customHeaders };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    const body: JsonRecord = {
      model,
      messages: openAIMessages(messages),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    };
    if (tools.length > 0) body.tools = tools.map(toOpenAIFormat);
    const response = await sendOpenAIChatCompletions(`${this.baseURL}/chat/completions`, headers, body, fetchFn ?? defaultFetch());
    onStream(response.content);
    return response;
  }
}

export type ProviderFactoryArgs = {
  provider: AIProviderConfig;
  apiKey: string;
  platform: PlatformInfo;
  onDeviceToolRunner?: OnDeviceToolRunner | null;
};

export function createProvider({ provider, apiKey, platform, onDeviceToolRunner }: ProviderFactoryArgs): AIProvider | null {
  if (!provider.isEnabled) return null;
  switch (provider.providerType) {
    case "gemini":
      return new GeminiProvider(apiKey, provider.baseURL);
    case "openrouter":
      return new OpenRouterProvider(apiKey, provider.baseURL);
    case "ollama":
      return new OllamaProvider(provider.baseURL);
    case "openai_compatible":
      return new OpenAICompatibleProvider(apiKey, provider.baseURL, provider.customHeaders);
    case "apple_intelligence":
      return new AppleIntelligenceProvider(platform, onDeviceToolRunner ?? null);
    default:
      return null;
  }
}

export async function fetchOpenRouterModels(apiKey: string, baseURL: string, fetchFn?: FetchFn): Promise<{ id: string; displayName: string; contextWindow: number; maxOutput: number }[]> {
  if (!apiKey) return [];
  const url = `${baseURL.replace(/\/$/, "")}/models`;
  const { status, json } = await getJson(url, { Authorization: `Bearer ${apiKey}` }, fetchFn ?? defaultFetch());
  if (status !== 200) return [];
  const models: { id: string; displayName: string; contextWindow: number; maxOutput: number }[] = [];
  for (const entry of asList(asRecord(json).data)) {
    const item = asRecord(entry);
    const id = asString(item.id);
    const name = asString(item.name);
    if (!id || !name) continue;
    const topProvider = asRecord(item.top_provider);
    models.push({
      id,
      displayName: name,
      contextWindow: asInt(item.context_length) || 128000,
      maxOutput: asInt(topProvider.max_completion_tokens) || 4096,
    });
  }
  return models;
}
