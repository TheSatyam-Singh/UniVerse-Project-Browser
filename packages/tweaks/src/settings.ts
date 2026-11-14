import {
  defaultSponsorBlockCategoryOptions,
  type SponsorBlockCategoryOptions,
} from "./sponsorBlock.ts";
import { DEFAULT_FACEBOOK_TWEAKS, type FacebookTweakSettings } from "./facebookTweaks.ts";
import { DEFAULT_REDDIT_TWEAKS, type RedditTweakSettings } from "./redditTweaks.ts";
import { DEFAULT_YOUTUBE_TWEAKS, type YouTubeTweakSettings } from "./youtubeTweaks.ts";
import { parseBoostsLossy, type Boost } from "./boost.ts";
import type { SiteRoutingRule } from "./siteRouting.ts";

export const TWEAKS_VERSION = 1;

export type TweaksSettings = {
  sponsorBlockEnabled: boolean;
  sponsorBlockCategoryOptions: SponsorBlockCategoryOptions;
  youTube: YouTubeTweakSettings;
  facebook: FacebookTweakSettings;
  reddit: RedditTweakSettings;
  boosts: Boost[];
  mediaDownloadSites: string[];
  siteRoutingRules: SiteRoutingRule[];
  allowUniverseLinks: boolean;
};

export function defaultTweaksSettings(): TweaksSettings {
  return {
    sponsorBlockEnabled: false,
    sponsorBlockCategoryOptions: defaultSponsorBlockCategoryOptions(),
    youTube: { ...DEFAULT_YOUTUBE_TWEAKS, hiddenHomeSections: [] },
    facebook: { ...DEFAULT_FACEBOOK_TWEAKS },
    reddit: { ...DEFAULT_REDDIT_TWEAKS },
    boosts: [],
    mediaDownloadSites: [],
    siteRoutingRules: [],
    allowUniverseLinks: false,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function validCategoryOptions(v: unknown): SponsorBlockCategoryOptions {
  const defaults = defaultSponsorBlockCategoryOptions();
  if (!isRecord(v)) return defaults;
  const out: SponsorBlockCategoryOptions = { ...defaults };
  for (const [k, val] of Object.entries(v)) {
    if (k in defaults && (val === "auto" || val === "manual" || val === "disabled")) out[k] = val;
  }
  return out;
}

function validSiteRules(v: unknown): SiteRoutingRule[] {
  if (!Array.isArray(v)) return [];
  const out: SiteRoutingRule[] = [];
  for (const item of v) {
    if (!isRecord(item)) continue;
    if (typeof item.id !== "string" || !item.id) continue;
    if (typeof item.domain !== "string" || !item.domain) continue;
    if (typeof item.targetProfileId !== "string" || !item.targetProfileId) continue;
    out.push({
      id: item.id,
      domain: item.domain,
      ...(typeof item.pathPrefix === "string" && item.pathPrefix ? { pathPrefix: item.pathPrefix } : {}),
      targetProfileId: item.targetProfileId,
      isEnabled: item.isEnabled !== false,
      ...(typeof item.legacyProfileId === "string" && item.legacyProfileId
        ? { legacyProfileId: item.legacyProfileId }
        : {}),
    });
  }
  return out;
}

export function parseTweaksSettings(json: string | null | undefined): TweaksSettings {
  const defaults = defaultTweaksSettings();
  if (!json) return defaults;
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch {
    return defaults;
  }
  if (!isRecord(doc)) return defaults;
  if (typeof doc.version === "number" && doc.version > TWEAKS_VERSION) return defaults;
  const youTube = isRecord(doc.youTube) ? doc.youTube : {};
  const facebook = isRecord(doc.facebook) ? doc.facebook : {};
  const reddit = isRecord(doc.reddit) ? doc.reddit : {};
  const videosPerRow = typeof youTube.videosPerRow === "number" ? youTube.videosPerRow : 0;
  return {
    sponsorBlockEnabled: doc.sponsorBlockEnabled === true,
    sponsorBlockCategoryOptions: validCategoryOptions(doc.sponsorBlockCategoryOptions),
    youTube: {
      hideShorts: youTube.hideShorts === true,
      hiddenHomeSections: stringList(youTube.hiddenHomeSections).filter((s) =>
        ["posts", "playables", "otherShelves", "surveys", "filterChips", "shorts"].includes(s),
      ) as YouTubeTweakSettings["hiddenHomeSections"],
      videosPerRow,
      frameThumbnails: youTube.frameThumbnails === true,
      noHoverPreview: youTube.noHoverPreview === true,
    },
    facebook: {
      hideReels: facebook.hideReels === true,
      hideSuggested: facebook.hideSuggested === true,
    },
    reddit: { sortHot: reddit.sortHot === true },
    boosts: parseBoostsLossy(doc.boosts),
    mediaDownloadSites: stringList(doc.mediaDownloadSites),
    siteRoutingRules: validSiteRules(doc.siteRoutingRules),
    allowUniverseLinks: doc.allowUniverseLinks === true,
  };
}

export function tweaksSettingsJson(settings: TweaksSettings): string {
  return JSON.stringify({ ...settings, version: TWEAKS_VERSION });
}
