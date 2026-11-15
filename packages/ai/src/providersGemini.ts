import { toGeminiFormat } from "./tools.ts";
import { httpError, invalidApiKey, invalidResponse } from "./errors.ts";
import { AI_PROVIDER_DEFAULT_BASE_URL } from "./types.ts";
import type { AIGenerationConfig, AIMessage, AIResponse, AIToolCall, AIToolDefinition, AIUsage, URLCitation } from "./types.ts";
import type { AIProvider, ProviderSendArgs } from "./providers.ts";
import { asInt, asList, asRecord, asString, defaultFetch, isRecord, postJson, type JsonRecord } from "./providerUtils.ts";

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
