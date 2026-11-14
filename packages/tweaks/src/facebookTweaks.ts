import { TWEAK_SCRIPTS } from "./scriptSources.ts";

export type FacebookTweakSettings = {
  hideReels: boolean;
  hideSuggested: boolean;
};

export const DEFAULT_FACEBOOK_TWEAKS: FacebookTweakSettings = { hideReels: false, hideSuggested: false };

export function isFacebookHost(host: string | undefined): boolean {
  if (!host) return false;
  const lowered = host.toLowerCase();
  return lowered === "facebook.com" || lowered.endsWith(".facebook.com");
}

export function facebookTweaksScript(settings: FacebookTweakSettings): string | null {
  if (!settings.hideReels && !settings.hideSuggested) return null;
  return `(function(){ if (!/(^|\\.)facebook\\.com$/.test(location.hostname)) return;\nvar f = window.__universeFBFilter = window.__universeFBFilter || {};\nf.reels = ${settings.hideReels}; f.suggested = ${settings.hideSuggested};\n${TWEAK_SCRIPTS.facebookFeedPrune}\n})();`;
}

export type SocialDownloadSettings = {
  mediaDownloadSites: string[];
};

export function enabledDownloadDomains(settings: SocialDownloadSettings): string[] {
  return settings.mediaDownloadSites.map((s) => s.toLowerCase().trim()).filter((s) => s.length > 0);
}

export function downloadSiteMatches(host: string | undefined, domains: string[]): boolean {
  if (!host) return false;
  const lowered = host.toLowerCase();
  return domains.some((d) => lowered === d || lowered.endsWith(`.${d}`));
}

export function socialDownloadScript(domains: string[]): string | null {
  if (!domains.length) return null;
  return `const UNIVERSE_DOWNLOAD_SITES = ${JSON.stringify(domains)};\n${TWEAK_SCRIPTS.socialImageDownload}`;
}

export const socialVideoSourceScript: string = TWEAK_SCRIPTS.socialVideoSource;
