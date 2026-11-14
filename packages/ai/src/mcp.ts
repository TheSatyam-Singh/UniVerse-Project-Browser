import { createRequire } from "node:module";
import type { MCPServerConfig, MCPTool } from "./types.ts";

export type MCPConnectionState = "disconnected" | "connecting" | "connected" | { error: string };

export function connectionStateIsConnected(state: MCPConnectionState): boolean {
  return state === "connected";
}

export function connectionStateLabel(state: MCPConnectionState): string {
  if (typeof state === "object") return state.error;
  return state;
}

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export function buildRequest(id: number, method: string, params?: Record<string, unknown>): JsonRpcRequest {
  const request: JsonRpcRequest = { jsonrpc: "2.0", id, method };
  if (params !== undefined) request.params = params;
  return request;
}

export function buildNotification(method: string, params?: Record<string, unknown>): JsonRpcNotification {
  const note: JsonRpcNotification = { jsonrpc: "2.0", method };
  if (params !== undefined) note.params = params;
  return note;
}

export class MCPError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MCPError";
    this.code = code;
  }
}

export type MCPTransport = {
  send: (data: string) => Promise<void>;
  onMessage: (handler: (data: string) => void) => void;
  close: () => Promise<void>;
};

export type FetchLike = (input: string, init?: Record<string, unknown>) => Promise<{ status: number; text: () => Promise<string> }>;

const MAX_MESSAGE_BYTES = 10 * 1024 * 1024;

export function isLocalOrHttps(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  return parsed.protocol === "https:" || local;
}

export function createSseTransport(url: string, fetchFn: FetchLike): MCPTransport {
  if (!isLocalOrHttps(url)) throw new MCPError("invalid_url", "MCP SSE transport requires HTTPS for non-local connections");
  let postEndpoint = url;
  let closed = false;
  let handler: ((data: string) => void) | null = null;
  let reader: Promise<void> | null = null;
  const encoder = new TextEncoder();
  const startReading = () => {
    if (reader) return;
    reader = (async () => {
      const impl = fetchFn as unknown as (input: string, init: Record<string, unknown>) => Promise<{ body?: AsyncIterable<Uint8Array> }>;
      const response = await impl(url, { method: "GET", headers: { Accept: "text/event-stream" } });
      const body = response.body;
      if (!body) return;
      const decoder = new TextDecoder();
      let buffer = "";
      for await (const chunk of body) {
        if (closed) break;
        buffer += decoder.decode(chunk, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (encoder.encode(data).length <= MAX_MESSAGE_BYTES) handler?.(data);
          } else if (line.startsWith("event: endpoint")) {
            // no-op: endpoint events carry no payload here
          }
          newline = buffer.indexOf("\n");
        }
      }
    })().catch(() => undefined);
  };
  return {
    async send(data: string): Promise<void> {
      const response = await fetchFn(postEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: data,
      });
      if (response.status < 200 || response.status >= 300) throw new MCPError("send_failed", "Failed to send MCP message");
    },
    onMessage(next: (data: string) => void): void {
      handler = next;
      startReading();
    },
    async close(): Promise<void> {
      closed = true;
    },
  };
}

export type ChildProcessFactory = (command: string, args: string[], env: Record<string, string>) => {
  stdinWrite: (data: string) => void;
  onStdoutLine: (handler: (line: string) => void) => void;
  close: () => void;
};

export function createNodeStdioTransport(
  command: string,
  args: string[],
  envVars: Record<string, string>,
  spawnFn?: ChildProcessFactory,
): MCPTransport {
  const spawn = spawnFn ?? defaultSpawn;
  const allowedInherited = new Set(["PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "TMPDIR", "TERM"]);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && (allowedInherited.has(key) || key.startsWith("LC_"))) env[key] = value;
  }
  for (const [key, value] of Object.entries(envVars)) env[key] = value;
  const child = spawn(command, args, env);
  let handler: ((data: string) => void) | null = null;
  child.onStdoutLine((line) => {
    if (line.length > 0 && line.length <= MAX_MESSAGE_BYTES) handler?.(line);
  });
  return {
    async send(data: string): Promise<void> {
      child.stdinWrite(data.endsWith("\n") ? data : `${data}\n`);
    },
    onMessage(next: (data: string) => void): void {
      handler = next;
    },
    async close(): Promise<void> {
      child.close();
    },
  };
}

function defaultSpawn(command: string, args: string[], env: Record<string, string>): {
  stdinWrite: (data: string) => void;
  onStdoutLine: (handler: (line: string) => void) => void;
  close: () => void;
} {
  const require = createRequire(import.meta.url);
  const { spawn } = require("node:child_process") as typeof import("node:child_process");
  const child = spawn(command, args, { env, stdio: ["pipe", "pipe", "ignore"] });
  let buffer = "";
  let lineHandler: ((line: string) => void) | null = null;
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (line.length > 0) lineHandler?.(line);
      newline = buffer.indexOf("\n");
    }
    if (buffer.length > MAX_MESSAGE_BYTES) {
      buffer = "";
      child.kill();
    }
  });
  return {
    stdinWrite: (data: string) => {
      child.stdin.write(data);
    },
    onStdoutLine: (next: (line: string) => void) => {
      lineHandler = next;
    },
    close: () => {
      try {
        child.stdin.end();
      } catch {
        // already closed
      }
      child.kill();
    },
  };
}

export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const MCP_REQUEST_TIMEOUT_MS = 30000;

export class MCPClient {
  readonly serverConfig: MCPServerConfig;
  private transport: MCPTransport | null = null;
  private transportFactory: (config: MCPServerConfig) => MCPTransport;
  private requestId = 0;
  private pending = new Map<number, { resolve: (value: JsonRpcResponse) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  connectionState: MCPConnectionState = "disconnected";
  discoveredTools: MCPTool[] = [];

  constructor(serverConfig: MCPServerConfig, transportFactory?: (config: MCPServerConfig) => MCPTransport) {
    this.serverConfig = serverConfig;
    this.transportFactory =
      transportFactory ??
      ((config) => {
        if (config.transport.kind === "stdio") {
          return createNodeStdioTransport(config.transport.command, config.transport.args, config.envVars);
        }
        const fetchImpl = (globalThis as { fetch?: unknown }).fetch as FetchLike | undefined;
        if (!fetchImpl) throw new MCPError("not_connected", "No fetch implementation available for SSE transport");
        return createSseTransport(config.transport.url, fetchImpl);
      });
  }

  async connect(): Promise<void> {
    this.connectionState = "connecting";
    try {
      const transport = this.transportFactory(this.serverConfig);
      this.transport = transport;
      transport.onMessage((data) => this.dispatch(data));
      await this.initialize();
      await this.listTools();
      this.connectionState = "connected";
    } catch (cause) {
      this.connectionState = { error: cause instanceof Error ? cause.message : String(cause) };
      throw cause;
    }
  }

  async disconnect(): Promise<void> {
    if (this.transport) await this.transport.close();
    this.transport = null;
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new MCPError("disconnected", "Disconnected from MCP server"));
    }
    this.pending.clear();
    this.connectionState = "disconnected";
    this.discoveredTools = [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const response = await this.sendRequest("tools/call", { name, arguments: args });
    if (response.error) throw new MCPError("server_error", `MCP server error: ${response.error.message}`);
    const result = response.result as Record<string, unknown> | undefined;
    const content = Array.isArray(result?.content) ? result.content : [];
    const parts: string[] = [];
    for (const entry of content) {
      const item = entry as Record<string, unknown>;
      if (typeof item.text === "string") parts.push(item.text);
    }
    return parts.length > 0 ? parts.join("\n") : "No result";
  }

  private async initialize(): Promise<void> {
    const response = await this.sendRequest("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "UniVerse-Project-Browser", version: "0.2.47" },
    });
    if (response.error) throw new MCPError("server_error", response.error.message);
    await this.sendNotification("notifications/initialized");
  }

  async listTools(): Promise<void> {
    const response = await this.sendRequest("tools/list");
    if (response.error) throw new MCPError("server_error", response.error.message);
    const result = response.result as Record<string, unknown> | undefined;
    const toolsArray = Array.isArray(result?.tools) ? result.tools : [];
    const tools: MCPTool[] = [];
    for (const entry of toolsArray) {
      const item = entry as Record<string, unknown>;
      const name = typeof item.name === "string" ? item.name : "";
      if (!name) continue;
      tools.push({
        serverId: this.serverConfig.id,
        name,
        description: typeof item.description === "string" ? item.description : "",
        inputSchema: (item.inputSchema as Record<string, unknown>) ?? {},
      });
    }
    this.discoveredTools = tools;
  }

  private sendRequest(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    if (!this.transport) return Promise.reject(new MCPError("not_connected", "Not connected to MCP server"));
    this.requestId += 1;
    const id = this.requestId;
    const data = JSON.stringify(buildRequest(id, method, params));
    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new MCPError("timeout", "MCP request timed out"));
      }, MCP_REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.transport
        ?.send(data)
        .catch((cause: unknown) => {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(cause instanceof Error ? cause : new Error(String(cause)));
        });
    });
  }

  private async sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    if (!this.transport) throw new MCPError("not_connected", "Not connected to MCP server");
    await this.transport.send(JSON.stringify(buildNotification(method, params)));
  }

  private dispatch(data: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    const response = parsed as JsonRpcResponse;
    if (typeof response.id !== "number") return;
    const pending = this.pending.get(response.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(response.id);
    pending.resolve(response);
  }
}

export class MCPToolFunctionRegistry {
  private toolsByFunctionName = new Map<string, MCPTool>();

  register(tool: MCPTool, taken: Set<string>): string {
    let functionName = tool.name;
    let suffix = 2;
    while (taken.has(functionName) || this.toolsByFunctionName.has(functionName)) {
      functionName = `${tool.serverId}_${tool.name}_${suffix}`;
      suffix += 1;
    }
    this.toolsByFunctionName.set(functionName, { ...tool, qualifiedName: `${tool.serverId}/${tool.name}` });
    return functionName;
  }

  get tools(): Map<string, MCPTool> {
    return this.toolsByFunctionName;
  }
}

export class MCPManager {
  private clients = new Map<string, MCPClient>();
  connectionStates = new Map<string, MCPConnectionState>();
  allTools: MCPTool[] = [];
  private clientFactory: (config: MCPServerConfig) => MCPClient;

  constructor(clientFactory?: (config: MCPServerConfig) => MCPClient) {
    this.clientFactory = clientFactory ?? ((config) => new MCPClient(config));
  }

  startEnabledServers(configs: MCPServerConfig[]): void {
    for (const config of configs) {
      if (config.isEnabled) this.connectServer(config);
    }
  }

  async stopAll(): Promise<void> {
    const running = [...this.clients.values()];
    this.clients.clear();
    this.connectionStates.clear();
    this.allTools = [];
    await Promise.all(running.map((client) => client.disconnect()));
  }

  connectServer(config: MCPServerConfig): void {
    const client = this.clientFactory(config);
    this.clients.set(config.id, client);
    this.connectionStates.set(config.id, "connecting");
    void client
      .connect()
      .then(() => {
        this.connectionStates.set(config.id, "connected");
        this.refreshTools();
      })
      .catch((cause: unknown) => {
        this.connectionStates.set(config.id, { error: cause instanceof Error ? cause.message : String(cause) });
      });
  }

  async disconnectServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client) return;
    await client.disconnect();
    this.clients.delete(serverId);
    this.connectionStates.set(serverId, "disconnected");
    this.refreshTools();
  }

  async callTool(serverId: string, name: string, args: Record<string, unknown>): Promise<string> {
    const client = this.clients.get(serverId);
    if (!client) throw new MCPError("not_connected", "Not connected to MCP server");
    return client.callTool(name, args);
  }

  connectionState(forServerId: string): MCPConnectionState {
    return this.connectionStates.get(forServerId) ?? "disconnected";
  }

  get hasConnectedServers(): boolean {
    return [...this.connectionStates.values()].some((state) => state === "connected");
  }

  private refreshTools(): void {
    const tools: MCPTool[] = [];
    for (const client of this.clients.values()) tools.push(...client.discoveredTools);
    this.allTools = tools;
  }
}
