import { networkError } from "./errors.ts";

export type FetchFn = (input: string, init?: Record<string, unknown>) => Promise<{
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

export function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function asInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
}

export function defaultFetch(): FetchFn {
  const impl = (globalThis as { fetch?: unknown }).fetch;
  if (typeof impl !== "function") throw new Error("No fetch implementation available");
  return impl as FetchFn;
}

export async function postJson(url: string, body: unknown, headers: Record<string, string>, fetchFn: FetchFn): Promise<{ status: number; json: unknown; text: string }> {
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

export async function getJson(url: string, headers: Record<string, string>, fetchFn: FetchFn): Promise<{ status: number; json: unknown; text: string }> {
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
