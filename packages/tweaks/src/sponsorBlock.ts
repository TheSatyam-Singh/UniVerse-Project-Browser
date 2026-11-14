import { sha256Hex } from "./sha256.ts";

export const SPONSORBLOCK_API = "https://sponsor.ajay.app/api";
export const SPONSORBLOCK_CACHE_TTL_MS = 3600_000;

export const YOUTUBE_DOMAINS: ReadonlySet<string> = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "tv.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
]);

export type SponsorBlockCategory =
  | "sponsor"
  | "selfpromo"
  | "exclusive_access"
  | "interaction"
  | "intro"
  | "outro"
  | "preview"
  | "filler"
  | "music_offtopic"
  | "poi_highlight";

export const SPONSORBLOCK_CATEGORIES: SponsorBlockCategory[] = [
  "sponsor",
  "selfpromo",
  "exclusive_access",
  "interaction",
  "intro",
  "outro",
  "preview",
  "filler",
  "music_offtopic",
  "poi_highlight",
];

export type SponsorBlockSkipOption = "auto" | "manual" | "disabled";

export type SponsorBlockCategoryOptions = Record<string, SponsorBlockSkipOption>;

export const SPONSORBLOCK_CATEGORY_INFO: Record<
  SponsorBlockCategory,
  { displayName: string; description: string; color: string; defaultSkip: SponsorBlockSkipOption }
> = {
  sponsor: { displayName: "Sponsor", description: "Paid promotion, paid referral, or direct advertisement", color: "#00D400", defaultSkip: "auto" },
  selfpromo: { displayName: "Self-Promotion", description: "Promoting a product or service that is directly related to the creator", color: "#FFFF00", defaultSkip: "disabled" },
  exclusive_access: { displayName: "Exclusive Access", description: "Showcasing a product or service in exchange for access", color: "#008A5C", defaultSkip: "disabled" },
  interaction: { displayName: "Interaction Reminder", description: "Asking for likes, subscriptions, or comments", color: "#CC00FF", defaultSkip: "disabled" },
  intro: { displayName: "Intermission/Intro", description: "Intermission or intro animation", color: "#00FFFF", defaultSkip: "disabled" },
  outro: { displayName: "Endcards/Credits", description: "Endcards, credits, or outro", color: "#0202ED", defaultSkip: "disabled" },
  preview: { displayName: "Preview/Recap", description: "Preview of upcoming content or recap of previous episodes", color: "#008FD6", defaultSkip: "disabled" },
  filler: { displayName: "Filler", description: "Tangential scenes that are not directly related to the main topic", color: "#7300FF", defaultSkip: "disabled" },
  music_offtopic: { displayName: "Non-Music Section", description: "Non-music sections in music videos", color: "#FF9900", defaultSkip: "disabled" },
  poi_highlight: { displayName: "Highlight", description: "The most important point of the video", color: "#FF1684", defaultSkip: "manual" },
};

export function defaultSponsorBlockCategoryOptions(): SponsorBlockCategoryOptions {
  const out: SponsorBlockCategoryOptions = {};
  for (const c of SPONSORBLOCK_CATEGORIES) out[c] = SPONSORBLOCK_CATEGORY_INFO[c].defaultSkip;
  return out;
}

export function enabledSponsorBlockCategories(options: SponsorBlockCategoryOptions): SponsorBlockCategory[] {
  return SPONSORBLOCK_CATEGORIES.filter((c) => options[c] !== "disabled" && options[c] !== undefined);
}

export type SponsorBlockActionType = "skip" | "mute" | "full" | "poi" | "chapter";

export type SponsorBlockSegment = {
  UUID: string;
  segment: [number, number];
  category: string;
  actionType: string;
  votes?: number;
  locked?: number;
};

export const segmentStart = (s: SponsorBlockSegment): number => s.segment[0]!;
export const segmentEnd = (s: SponsorBlockSegment): number => s.segment[1]!;

export function isValidSegment(s: SponsorBlockSegment): boolean {
  if (!Array.isArray(s.segment) || s.segment.length !== 2) return false;
  const [start, end] = s.segment as [number, number];
  return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && start < end && end < 86400;
}

export function isYouTubeDomain(host: string): boolean {
  const lowered = host.toLowerCase();
  if (YOUTUBE_DOMAINS.has(lowered)) return true;
  const dot = lowered.indexOf(".");
  if (dot > 0) return YOUTUBE_DOMAINS.has(lowered.slice(dot + 1));
  return false;
}

export function sponsorBlockHashPrefix(videoId: string, length = 4): string {
  return sha256Hex(videoId).slice(0, length);
}

type HashResponse = { videoID: string; hash?: string; segments: SponsorBlockSegment[] };

export type FetchFn = (url: string) => Promise<{ status: number; json(): Promise<unknown> }>;

export type SponsorBlockClientOptions = {
  enabled: boolean;
  categoryOptions: SponsorBlockCategoryOptions;
  fetchFn?: FetchFn;
  now?: () => number;
};

export class SponsorBlockClient {
  private cache = new Map<string, { segments: SponsorBlockSegment[]; fetchedAt: number }>();
  private options: SponsorBlockClientOptions;

  constructor(options: SponsorBlockClientOptions) {
    this.options = options;
  }

  setOptions(patch: Partial<SponsorBlockClientOptions>): void {
    this.options = { ...this.options, ...patch };
  }

  clearCache(): void {
    this.cache.clear();
  }

  async fetchSegments(videoId: string): Promise<SponsorBlockSegment[]> {
    const now = this.options.now ?? Date.now;
    const cached = this.cache.get(videoId);
    if (cached && now() - cached.fetchedAt < SPONSORBLOCK_CACHE_TTL_MS) return cached.segments;
    if (!this.options.enabled) return [];
    const enabled = enabledSponsorBlockCategories(this.options.categoryOptions);
    if (!enabled.length) return [];

    const prefix = sponsorBlockHashPrefix(videoId);
    const fullHash = sha256Hex(videoId);
    const categories = encodeURIComponent(JSON.stringify(enabled));
    const url = `${SPONSORBLOCK_API}/skipSegments/${prefix}?categories=${categories}`;
    const fetchFn: FetchFn =
      this.options.fetchFn ??
      (async (u: string) => {
        const res = await fetch(u);
        return { status: res.status, json: async () => (await res.json()) as unknown };
      });
    try {
      const res = await fetchFn(url);
      if (res.status === 404) {
        this.store(videoId, [], now());
        return [];
      }
      if (res.status !== 200) return [];
      const data = (await res.json()) as HashResponse[];
      const match = Array.isArray(data)
        ? data.find((r) => r.videoID === videoId || r.hash === fullHash)
        : undefined;
      if (!match) {
        this.store(videoId, [], now());
        return [];
      }
      const enabledSet = new Set(enabled);
      const segments = match.segments
        .filter((s) => isValidSegment(s) && enabledSet.has(s.category) && (s.actionType === "skip" || s.actionType === "mute"))
        .sort((a, b) => segmentStart(a) - segmentStart(b));
      this.store(videoId, segments, now());
      return segments;
    } catch {
      return [];
    }
  }

  static deliverScript(segments: SponsorBlockSegment[], options: SponsorBlockCategoryOptions): string {
    return `window.__universeSponsorBlock?.receiveSegments(${JSON.stringify(segments)}, ${JSON.stringify(options)})`;
  }

  reportViewedSegment(uuid: string, isPrivate: boolean): void {
    if (!this.options.enabled || isPrivate) return;
    const url = `${SPONSORBLOCK_API}/viewedVideoSponsorTime?UUID=${encodeURIComponent(uuid)}`;
    void (this.options.fetchFn
      ? this.options.fetchFn(url).catch(() => undefined)
      : fetch(url, { method: "POST" }).catch(() => undefined));
  }

  private store(videoId: string, segments: SponsorBlockSegment[], at: number): void {
    for (const [id, entry] of this.cache) {
      if (at - entry.fetchedAt >= SPONSORBLOCK_CACHE_TTL_MS) this.cache.delete(id);
    }
    this.cache.set(videoId, { segments, fetchedAt: at });
  }
}
