import { httpError, invalidApiKey, invalidResponse, insecureUrl, networkError, requireHttpsForRemote, unsupportedFeature } from "./errors.ts";
import { toGeminiFormat, toOpenAIFormat } from "./tools.ts";
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
import { AI_PROVIDER_DEFAULT_BASE_URL, APPLE_INTELLIGENCE_MIN_MACOS, APPLE_INTELLIGENCE_MODEL_ID, APPLE_INTELLIGENCE_PROVIDER_ID } from "./types.ts";

export type FetchFn = (input: string, init?: Record<string, unknown>) => Promise<{
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

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

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
}

function defaultFetch(): FetchFn {
  const impl = (globalThis as { fetch?: unknown }).fetch;
  if (typeof impl !== "function") throw new Error("No fetch implementation available");
  return impl as FetchFn;
}

async function postJson(url: string, body: unknown, headers: Record<string, string>, fetchFn: FetchFn): Promise<{ status: number; json: unknown; text: string }> {
  let response: { status: number; json: () => Promise<unknown>; text: () => Promise<string> };
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw networkError(cause);
  }
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

async function getJson(url: string, headers: Record<string, string>, fetchFn: FetchFn): Promise<{ status: number; json: unknown; text: string }> {
  let response: { status: number; json: () => Promise<unknown>; text: () => Promise<string> };
  try {
    response = await fetchFn(url, { method: "GET", headers });
  } catch (cause) {
    throw networkError(cause);
  }
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

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

function geminiBody(messages: AIMessage[], config: AIGenerationConfig, tools: AIToolDefinition[]): JsonRecord {
  const body: JsonRecord = {};
  const system = messages.find((m) => m.role === "system");
  if (system && system.content) body.system_instruction = { parts: [{ text: system.content }] };
  const contents: JsonRecord[] = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    if (message.role === "user") {
      contents.push({ role: "user", parts: [{ text: message.content }] });
    } else if (message.role === "assistant") {
      if (message.toolCalls && message.toolCalls.length > 0) {
        const parts: JsonRecord[] = [];
        if (message.content) parts.push({ text: message.content });
        for (const call of message.toolCalls) {
          const part: JsonRecord = { functionCall: { name: call.name, args: call.arguments } };
          if (call.thoughtSignature) part.thoughtSignature = call.thoughtSignature;
          parts.push(part);
        }
        contents.push({ role: "model", parts });
      } else {
        contents.push({ role: "model", parts: [{ text: message.content }] });
      }
    } else if (message.role === "tool") {
      contents.push({
        role: "user",
        parts: (message.toolResults ?? []).map((result) => ({
          functionResponse: { id: result.toolCallId, name: result.toolName, response: { content: result.content } },
        })),
      });
    }
  }
  body.contents = contents;
  const allTools: JsonRecord[] = [];
  if (config.webSearchEnabled) allTools.push({ google_search: {} });
  if (tools.length > 0) allTools.push({ function_declarations: tools.map(toGeminiFormat) });
  if (allTools.length > 0) body.tools = allTools;
  body.generationConfig = { temperature: config.temperature, maxOutputTokens: config.maxTokens };
  return body;
}

function parseGeminiResponse(data: unknown): AIResponse {
  const root = asRecord(data);
  const candidates = asList(root.candidates);
  const first = asRecord(candidates[0]);
  const content = asRecord(first.content);
  const parts = asList(content.parts);
  let textContent = "";
  const toolCalls: AIToolCall[] = [];
  for (const entry of parts) {
    const part = asRecord(entry);
    if (typeof part.text === "string") textContent += part.text;
    const call = asRecord(part.functionCall);
    const name = asString(call.name);
    if (name) {
      const args = isRecord(call.args) ? call.args : {};
      const callId = asString(call.id) || `gemini-${toolCalls.length}-${Date.now()}`;
      const toolCall: AIToolCall = { id: callId, name, arguments: args };
      if (typeof part.thoughtSignature === "string") toolCall.thoughtSignature = part.thoughtSignature;
      toolCalls.push(toolCall);
    }
  }
  if (parts.length === 0) throw invalidResponse("Gemini returned no candidates");
  const citations = parseInlineCitations(textContent);
  let usage: AIUsage | undefined;
  const usageData = asRecord(root.usageMetadata);
  if (typeof usageData.promptTokenCount === "number") {
    const prompt = asInt(usageData.promptTokenCount);
    const completion = asInt(usageData.candidatesTokenCount);
    usage = { promptTokens: prompt, completionTokens: completion, totalTokens: prompt + completion };
  }
  return { content: textContent, toolCalls, citations, usage, finishReason: toolCalls.length > 0 ? "tool_calls" : "stop" };
}

export function parseInlineCitations(text: string): URLCitation[] {
  const citations: URLCitation[] = [];
  const pattern = /\[(\d+)\]\((https?:\/\/[^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const url = match[2] ?? "";
    let host: string | undefined;
    try {
      host = new URL(url).host.replace(/^www\./, "");
    } catch {
      host = undefined;
    }
    const citation: URLCitation = { url, title: host, startIndex: match.index, endIndex: match.index + match[0].length };
    if (!citations.some((c) => c.url === citation.url)) citations.push(citation);
  }
  return citations;
}

export class GeminiProvider implements AIProvider {
  readonly providerId = "gemini";
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string = AI_PROVIDER_DEFAULT_BASE_URL.gemini) {
    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/$/, "");
  }

  async sendMessage({ messages, model, config, tools, onStream, fetchFn }: ProviderSendArgs): Promise<AIResponse> {
    if (!this.apiKey) throw invalidApiKey();
    const url = `${this.baseURL}/models/${encodeURIComponent(model)}:generateContent`;
    const { status, json, text } = await postJson(
      url,
      geminiBody(messages, config, tools),
      { "x-goog-api-key": this.apiKey },
      fetchFn ?? defaultFetch(),
    );
    if (status !== 200) throw httpError(status, text);
    const response = parseGeminiResponse(json);
    onStream(response.content);
    return response;
  }
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

export class OllamaProvider implements AIProvider {
  readonly providerId = "ollama";
  private baseURL: string;

  constructor(baseURL: string = AI_PROVIDER_DEFAULT_BASE_URL.ollama) {
    this.baseURL = baseURL.replace(/\/$/, "");
  }

  async sendMessage({ messages, model, config, tools, onStream, fetchFn }: ProviderSendArgs): Promise<AIResponse> {
    const url = `${this.baseURL}/api/chat`;
    const messagesArray: JsonRecord[] = [];
    for (const message of messages) {
      if (message.role === "system" || message.role === "user") {
        messagesArray.push({ role: message.role, content: message.content });
      } else if (message.role === "assistant") {
        if (message.toolCalls && message.toolCalls.length > 0) {
          messagesArray.push({
            role: "assistant",
            content: message.content,
            tool_calls: message.toolCalls.map((call) => ({ function: { name: call.name, arguments: call.arguments } })),
          });
        } else {
          messagesArray.push({ role: "assistant", content: message.content });
        }
      } else if (message.role === "tool") {
        for (const result of message.toolResults ?? []) {
          messagesArray.push({ role: "tool", content: result.content });
        }
      }
    }
    const body: JsonRecord = {
      model,
      messages: messagesArray,
      stream: false,
      options: { temperature: config.temperature },
    };
    if (tools.length > 0) {
      body.tools = tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
    }
    const { status, json, text } = await postJson(url, body, {}, fetchFn ?? defaultFetch());
    if (status !== 200) throw httpError(status, text || "API request failed. Make sure Ollama is running.");
    const root = asRecord(json);
    const message = asRecord(root.message);
    if (!message || Object.keys(message).length === 0) throw invalidResponse("Ollama returned no message");
    const content = asString(message.content);
    const toolCalls: AIToolCall[] = [];
    for (const entry of asList(message.tool_calls)) {
      const item = asRecord(entry);
      const fn = asRecord(item.function);
      const name = asString(fn.name);
      if (!name) continue;
      toolCalls.push({ id: `ollama-${toolCalls.length}`, name, arguments: isRecord(fn.arguments) ? fn.arguments : {} });
    }
    let usage: AIUsage | undefined;
    if (typeof root.prompt_eval_count === "number" && typeof root.eval_count === "number") {
      const prompt = asInt(root.prompt_eval_count);
      const completion = asInt(root.eval_count);
      usage = { promptTokens: prompt, completionTokens: completion, totalTokens: prompt + completion };
    }
    const response: AIResponse = { content, toolCalls, citations: [], usage, finishReason: toolCalls.length > 0 ? "tool_calls" : "stop" };
    onStream(content);
    return response;
  }

  async listModels(fetchFn?: FetchFn): Promise<{ id: string; displayName: string }[]> {
    const { status, json } = await getJson(`${this.baseURL}/api/tags`, {}, fetchFn ?? defaultFetch());
    if (status !== 200) return [];
    const models: { id: string; displayName: string }[] = [];
    for (const entry of asList(asRecord(json).models)) {
      const name = asString(asRecord(entry).name);
      if (name) models.push({ id: name, displayName: name });
    }
    return models.sort((a, b) => a.displayName.localeCompare(b.displayName));
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

export type OnDeviceToolRunner = (name: string, argumentsJson: string) => Promise<string>;

export function appleIntelligenceAvailable(platform: PlatformInfo): boolean {
  if (platform.os !== "darwin") return false;
  if ((platform.macOSMajor ?? 0) < APPLE_INTELLIGENCE_MIN_MACOS) return false;
  return platform.appleIntelligenceAvailable !== false;
}

export function appleIntelligenceUnavailableNote(platform: PlatformInfo): string | null {
  if (platform.os !== "darwin" || (platform.macOSMajor ?? 0) < APPLE_INTELLIGENCE_MIN_MACOS) {
    return "Apple Intelligence requires macOS 26 or later.";
  }
  if (platform.appleIntelligenceAvailable === false) {
    return "Apple Intelligence needs to be turned on in System Settings > Apple Intelligence & Siri.";
  }
  return null;
}

export function estimateTokens(text: string): number {
  let quarters = 0;
  for (const ch of text) quarters += ch.codePointAt(0)! < 128 ? 1 : 4;
  return Math.floor((quarters + 3) / 4);
}

export function fittedToTokens(text: string, tokens: number): string {
  let budget = tokens * 4;
  let end = 0;
  for (const ch of text) {
    const cost = (ch.codePointAt(0)! < 128 ? 1 : 4);
    budget -= cost;
    if (budget < 0) return text.slice(0, end) + "…";
    end += ch.length;
  }
  return text;
}

export class AppleIntelligenceProvider implements AIProvider {
  readonly providerId = APPLE_INTELLIGENCE_PROVIDER_ID;
  static readonly modelId = APPLE_INTELLIGENCE_MODEL_ID;
  private platform: PlatformInfo;
  private runTool: OnDeviceToolRunner | null;

  constructor(platform: PlatformInfo, runTool: OnDeviceToolRunner | null = null) {
    this.platform = platform;
    this.runTool = runTool;
  }

  isAvailable(): boolean {
    return appleIntelligenceAvailable(this.platform);
  }

  async sendMessage(_args: ProviderSendArgs): Promise<AIResponse> {
    throw unsupportedFeature(
      "On-device chat requires macOS 26 or later and Apple Intelligence, reached through the native Foundation Models bridge in the macOS shell. This TypeScript provider is a gate, not an implementation.",
    );
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
