import { TWEAK_SCRIPTS } from "./scriptSources.ts";

export type RedditTweakSettings = {
  sortHot: boolean;
};

export const DEFAULT_REDDIT_TWEAKS: RedditTweakSettings = { sortHot: false };

export const redditTweaksScript: string = TWEAK_SCRIPTS.redditTweaks;

export function isRedditHost(host: string | undefined): boolean {
  if (!host) return false;
  const lowered = host.toLowerCase();
  return lowered === "reddit.com" || lowered === "www.reddit.com";
}

export function redditHotUrl(url: string, settings: RedditTweakSettings): string | null {
  if (!settings.sortHot) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!isRedditHost(parsed.host)) return null;
  const parts = parsed.pathname.split("/").filter((p) => p.length > 0);
  const isFeed =
    (parts.length === 2 && parts[0] === "r") ||
    (parts.length === 4 && parts[0] === "user" && parts[2] === "m");
  if (!isFeed) return null;
  parsed.pathname = `/${parts.map((p) => `${p}/`).join("")}hot/`;
  return parsed.toString();
}
