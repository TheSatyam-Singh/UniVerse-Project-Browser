export type AIProviderErrorCode =
  | "invalid_api_key"
  | "invalid_response"
  | "http_error"
  | "rate_limited"
  | "network_error"
  | "unsupported_feature"
  | "insecure_url";

export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode;
  readonly status?: number;

  constructor(code: AIProviderErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
    this.status = status;
  }
}

export function invalidApiKey(): AIProviderError {
  return new AIProviderError("invalid_api_key", "Invalid or missing API key");
}

export function invalidResponse(detail?: string): AIProviderError {
  return new AIProviderError("invalid_response", detail ? `Failed to parse response: ${detail}` : "Failed to parse response");
}

export function httpError(status: number, body: string): AIProviderError {
  if (status === 429) return new AIProviderError("rate_limited", "Rate limit exceeded. Please try again later.", status);
  return new AIProviderError("http_error", `HTTP ${status}: ${body}`, status);
}

export function unsupportedFeature(feature: string): AIProviderError {
  return new AIProviderError("unsupported_feature", `${feature} is not supported by this provider`);
}

export function insecureUrl(url: string): AIProviderError {
  return new AIProviderError("insecure_url", `Custom provider URL must use HTTPS for non-local connections: ${url}`);
}

export function networkError(cause: unknown): AIProviderError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new AIProviderError("network_error", `Network error: ${detail}`);
}

export function isLocalHost(host: string): boolean {
  const lower = host.toLowerCase();
  return lower === "localhost" || lower === "127.0.0.1" || lower === "::1" || lower.endsWith(".local");
}

export function requireHttpsForRemote(baseURL: string): void {
  let parsed: URL;
  try {
    parsed = new URL(baseURL);
  } catch {
    throw insecureUrl(baseURL);
  }
  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (scheme !== "https" && !isLocalHost(parsed.hostname)) throw insecureUrl(baseURL);
}
