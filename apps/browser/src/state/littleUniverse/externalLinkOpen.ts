import { isWebPageUrl } from "../../lib/url";

export type ExternalLinkOpen = "tab" | "littleUniverse" | "window";

export function externalLinkOpen(littleUniverseOn: boolean, urls: readonly string[], ruled: ExternalLinkOpen | null = null): ExternalLinkOpen {
  if (ruled) return ruled;
  const [url] = urls;
  return littleUniverseOn && urls.length === 1 && !!url && isWebPageUrl(url) ? "littleUniverse" : "tab";
}
