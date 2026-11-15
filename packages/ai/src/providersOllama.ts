import { httpError, invalidResponse } from "./errors.ts";
import { AI_PROVIDER_DEFAULT_BASE_URL } from "./types.ts";
import type { AIResponse, AIToolCall, AIUsage } from "./types.ts";
import type { AIProvider, ProviderSendArgs } from "./providers.ts";
import { asInt, asList, asRecord, asString, defaultFetch, getJson, isRecord, postJson, type FetchFn, type JsonRecord } from "./providerUtils.ts";

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
