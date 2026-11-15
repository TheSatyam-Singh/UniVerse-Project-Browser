import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

export const DEV_MCP_PORT = 47823;
export const DEV_MCP_MAX_BODY_BYTES = 8 * 1024 * 1024;
export const DEV_MCP_TOOL_TIMEOUT_MS = 30000;

export function devMcpTokenDir(): string {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "com.universe.projectbrowser");
  }
  return join(homedir(), ".config", "universe-project-browser");
}

export function loadOrCreateDevMcpToken(dir: string = devMcpTokenDir()): string {
  const file = join(dir, "dev-mcp-token");
  if (existsSync(file)) {
    const existing = readFileSync(file, "utf8").trim();
    if (existing.length >= 32) return existing;
  }
  mkdirSync(dir, { recursive: true });
  const fresh = randomBytes(32).toString("hex");
  writeFileSync(file, fresh, { mode: 0o600 });
  try {
    chmodSync(file, 0o600);
  } catch {
  }
  return fresh;
}

export function devMcpDownloadsRoot(): string {
  return join(homedir(), "Downloads", "UniVerse MCP");
}

export function fnv1aHash(value: string): string {
  let hash = 2166136261;
  for (const byte of Buffer.from(value, "utf8")) {
    hash = (hash ^ byte) >>> 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function resolveDevMcpPath(relative: string, root: string = devMcpDownloadsRoot()): string | null {
  if (!relative || relative.startsWith("/") || relative.startsWith("~")) return null;
  const base = resolve(root);
  const target = resolve(base, relative);
  if (target !== base && !target.startsWith(base + sep)) return null;
  if (target === base) return null;
  const parts = relative.split("/").filter((part) => part.length > 0);
  if (parts.includes("..")) return null;
  return target;
}

export function devMcpFileName(url: string, contentType?: string): string {
  const allowed = /[^A-Za-z0-9\-_.]/g;
  let last = "";
  try {
    last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
  } catch {
    last = "";
  }
  let name = last.replace(allowed, "").slice(0, 80);
  if (!name || name === "." || name === "..") name = "file";
  if (!name.includes(".")) {
    const ext = contentType ? extensionForContentType(contentType) : undefined;
    if (ext) name += `.${ext}`;
  }
  return `${fnv1aHash(url)}-${name}`;
}

export function extensionForContentType(contentType: string): string | undefined {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "image/svg+xml": "svg",
    "application/pdf": "pdf",
    "application/json": "json",
    "text/html": "html",
    "text/plain": "txt",
    "video/mp4": "mp4",
  };
  return map[type];
}

export type DevMcpTab = { index: number; title: string; url: string; isActive: boolean };

export type DevMcpBridge = {
  listTabs: () => DevMcpTab[];
  openUrl: (url: string) => string;
  navigate: (url: string) => string;
  readPage: (maxLength?: number) => Promise<string>;
  evaluate: (code: string) => Promise<unknown>;
  downloadUrl: (url: string, fileName: string) => Promise<string>;
};

export type DevMcpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export const DEV_MCP_TOOLS: DevMcpToolDefinition[] = [
  {
    name: "list_tabs",
    description: "List the browser's open tabs with titles and URLs.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "open_url",
    description: "Open a URL in a new tab.",
    inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
  {
    name: "navigate_to_url",
    description: "Navigate the current tab to a URL.",
    inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
  {
    name: "read_page",
    description: "Read the text of the current page.",
    inputSchema: { type: "object", properties: { maxLength: { type: "integer" } } },
  },
  {
    name: "evaluate",
    description: "Evaluate JavaScript on the current page and return the result as text.",
    inputSchema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
  },
  {
    name: "download_url",
    description: "Download a URL into ~/Downloads/UniVerse MCP and return the saved path.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" }, fileName: { type: "string" } },
      required: ["url"],
    },
  },
];

type JsonRpcEnvelope = {
  jsonrpc: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
};

function textContent(text: string): Record<string, unknown> {
  return { content: [{ type: "text", text }] };
}

function errorResult(message: string): Record<string, unknown> {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function bearerTokenOf(headers: Record<string, string | string[] | undefined>): string | null {
  const header = headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || !value.startsWith("Bearer ")) return null;
  return value.slice("Bearer ".length).trim() || null;
}

export async function handleDevMcpRpc(envelope: JsonRpcEnvelope, bridge: DevMcpBridge): Promise<Record<string, unknown>> {
  const id = envelope.id ?? null;
  const method = envelope.method ?? "";
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "UniVerse-Project-Browser", version: "0.2.47" },
      },
    };
  }
  if (method === "notifications/initialized") {
    return { jsonrpc: "2.0", id, result: {} };
  }
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: DEV_MCP_TOOLS } };
  }
  if (method === "tools/call") {
    const params = envelope.params ?? {};
    const name = typeof params.name === "string" ? params.name : "";
    const args = (params.arguments as Record<string, unknown>) ?? {};
    try {
      const result = await callDevMcpTool(name, args, bridge);
      return { jsonrpc: "2.0", id, result };
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      return { jsonrpc: "2.0", id, result: errorResult(detail) };
    }
  }
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}

export async function callDevMcpTool(name: string, args: Record<string, unknown>, bridge: DevMcpBridge): Promise<Record<string, unknown>> {
  switch (name) {
    case "list_tabs":
      return textContent(JSON.stringify(bridge.listTabs(), null, 2));
    case "open_url": {
      const url = typeof args.url === "string" ? args.url : "";
      if (!url) throw new Error("Missing url");
      return textContent(bridge.openUrl(url));
    }
    case "navigate_to_url": {
      const url = typeof args.url === "string" ? args.url : "";
      if (!url) throw new Error("Missing url");
      return textContent(bridge.navigate(url));
    }
    case "read_page": {
      const maxLength = typeof args.maxLength === "number" ? Math.floor(args.maxLength) : undefined;
      return textContent(await bridge.readPage(maxLength));
    }
    case "evaluate": {
      const code = typeof args.code === "string" ? args.code : "";
      if (!code) throw new Error("Missing code");
      const out = await bridge.evaluate(code);
      return textContent(out === undefined || out === null ? "No return value" : typeof out === "string" ? out : JSON.stringify(out));
    }
    case "download_url": {
      const url = typeof args.url === "string" ? args.url : "";
      if (!url) throw new Error("Missing url");
      const fileName = typeof args.fileName === "string" && args.fileName ? args.fileName : devMcpFileName(url);
      const resolved = resolveDevMcpPath(fileName);
      if (!resolved) throw new Error("Refusing to write outside ~/Downloads/UniVerse MCP");
      return textContent(await bridge.downloadUrl(url, resolved));
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export type DevMcpServerHandle = {
  port: number;
  stop: () => Promise<void>;
};

export function startDevMcpServer(bridge: DevMcpBridge, options: { port?: number; token?: string } = {}): DevMcpServerHandle {
  const port = options.port ?? DEV_MCP_PORT;
  const token = options.token ?? loadOrCreateDevMcpToken();
  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.url !== "/mcp") {
        send(404, { error: "Not found" });
        return;
      }
      if (req.method !== "POST") {
        send(405, { error: "Method not allowed" });
        return;
      }
      if (bearerTokenOf(req.headers) !== token) {
        send(401, { error: "Unauthorized" });
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > DEV_MCP_MAX_BODY_BYTES) {
          send(413, { error: "Body too large" });
          return;
        }
        chunks.push(chunk as Buffer);
      }
      const envelope = JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonRpcEnvelope;
      const timeout = new Promise<Record<string, unknown>>((resolvePromise) => {
        setTimeout(() => resolvePromise({ jsonrpc: "2.0", id: envelope.id ?? null, error: { code: -32000, message: "Tool timed out" } }), DEV_MCP_TOOL_TIMEOUT_MS);
      });
      const result = await Promise.race([handleDevMcpRpc(envelope, bridge), timeout]);
      send(200, result);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      send(400, { error: detail });
    }
  });
  server.listen(port, "127.0.0.1");
  return {
    get port() {
      const address = server.address();
      return typeof address === "object" && address ? address.port : port;
    },
    stop: () =>
      new Promise<void>((resolvePromise) => {
        server.close(() => resolvePromise());
      }),
  };
}
