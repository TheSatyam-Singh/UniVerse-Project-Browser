import { createRequire } from "node:module";
import type { MCPTransport } from "./mcp.ts";

export const MAX_MESSAGE_BYTES = 10 * 1024 * 1024;

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
  const child = spawn(command, args, { env: env as unknown as NodeJS.ProcessEnv, stdio: ["pipe", "pipe", "ignore"] });
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
      }
      child.kill();
    },
  };
}

