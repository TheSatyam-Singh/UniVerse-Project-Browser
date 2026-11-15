import { unsupportedFeature } from "./errors.ts";
import { APPLE_INTELLIGENCE_MIN_MACOS, APPLE_INTELLIGENCE_MODEL_ID, APPLE_INTELLIGENCE_PROVIDER_ID } from "./types.ts";
import type { AIResponse, PlatformInfo } from "./types.ts";
import type { AIProvider, ProviderSendArgs } from "./providers.ts";

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
