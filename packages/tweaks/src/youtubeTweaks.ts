import { TWEAK_SCRIPTS } from "./scriptSources.ts";

export type YouTubeHomeSection = "posts" | "playables" | "otherShelves" | "surveys" | "filterChips" | "shorts";

export type YouTubeTweakSettings = {
  hideShorts: boolean;
  hiddenHomeSections: YouTubeHomeSection[];
  videosPerRow: number;
  frameThumbnails: boolean;
  noHoverPreview: boolean;
};

export const YOUTUBE_VIDEOS_PER_ROW_RANGE = { min: 3, max: 8 };
export const DEFAULT_YOUTUBE_TWEAKS: YouTubeTweakSettings = {
  hideShorts: false,
  hiddenHomeSections: [],
  videosPerRow: 0,
  frameThumbnails: false,
  noHoverPreview: false,
};

const SHORTS_ITEM = "ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2";
const POST_ITEMS = "ytd-post-renderer, ytd-backstage-post-thread-renderer";
const GAME_ITEMS = "ytd-mini-game-card-view-model, ytd-game-card-renderer";

export const YOUTUBE_SHORTS_SELECTORS: string[] = [
  `ytd-rich-section-renderer:has(${SHORTS_ITEM})`,
  `grid-shelf-view-model:has(${SHORTS_ITEM})`,
  "ytd-reel-shelf-renderer",
  'ytd-rich-item-renderer:has(a[href^="/shorts/"])',
  'ytd-video-renderer:has(a[href^="/shorts/"])',
  'yt-lockup-view-model:has(a[href^="/shorts/"])',
  'ytd-guide-entry-renderer:has(a[href^="/shorts"])',
  'ytd-mini-guide-entry-renderer:has(a[href^="/shorts"])',
  'yt-tab-shape[tab-title="Shorts"]',
];

export function youTubeHomeSectionSelector(section: YouTubeHomeSection): string | null {
  switch (section) {
    case "posts":
      return `ytd-rich-section-renderer:has(${POST_ITEMS})`;
    case "playables":
      return `ytd-rich-section-renderer:has(${GAME_ITEMS})`;
    case "otherShelves":
      return `ytd-rich-section-renderer:has(ytd-rich-shelf-renderer):not(:has(${SHORTS_ITEM}, ${POST_ITEMS}, ${GAME_ITEMS}))`;
    case "surveys":
      return "ytd-rich-section-renderer:has(ytd-inline-survey-renderer, ytd-statement-banner-renderer, ytd-brand-video-shelf-renderer)";
    case "filterChips":
      return "ytd-feed-filter-chip-bar-renderer";
    case "shorts":
      return null;
  }
}

export function youTubeTweaksCss(settings: YouTubeTweakSettings): string {
  const hidden: string[] = [];
  if (settings.hideShorts) hidden.push(...YOUTUBE_SHORTS_SELECTORS);
  for (const section of settings.hiddenHomeSections) {
    if (section === "shorts") continue;
    const selector = youTubeHomeSectionSelector(section);
    if (selector) hidden.push(`ytd-browse[page-subtype="home"] ${selector}`);
  }
  const rules = hidden.map((s) => `${s} { display: none !important; }`);
  if (settings.hiddenHomeSections.includes("filterChips")) {
    rules.push(
      'ytd-app:has(ytd-browse[page-subtype="home"]:not([hidden])) #frosted-glass.with-chipbar { height: var(--ytd-masthead-height, 56px) !important; }',
    );
  }
  const perRow = settings.videosPerRow;
  if (perRow >= YOUTUBE_VIDEOS_PER_ROW_RANGE.min && perRow <= YOUTUBE_VIDEOS_PER_ROW_RANGE.max) {
    rules.push(
      `ytd-rich-grid-renderer { --ytd-rich-grid-items-per-row: ${perRow} !important; --ytd-rich-grid-posts-per-row: ${perRow} !important; }`,
    );
  }
  if (settings.noHoverPreview) {
    rules.push("ytd-video-preview { display: none !important; }");
  }
  if (settings.frameThumbnails) {
    rules.push("img[data-universe-frame] { width: 100% !important; height: 100% !important; object-fit: cover !important; }");
  }
  return rules.join("\n");
}

export function isYouTubeTweaksHost(host: string): boolean {
  const lowered = host.toLowerCase();
  return lowered === "www.youtube.com" || lowered === "youtube.com";
}

export function youTubeTweaksScript(settings: YouTubeTweakSettings): string | null {
  const css = youTubeTweaksCss(settings);
  if (!css && !settings.frameThumbnails && !settings.noHoverPreview) return null;
  const config = JSON.stringify({
    css,
    frameThumbnails: settings.frameThumbnails,
    noHoverPreview: settings.noHoverPreview,
  });
  return `${TWEAK_SCRIPTS.youtubeTweaks}(${config});`;
}
