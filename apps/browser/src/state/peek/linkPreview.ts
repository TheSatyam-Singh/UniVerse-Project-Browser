export type LinkPreviewPage = {
  title?: string;
  description?: string;
  imageUrl?: string;
  iconUrl?: string;
  siteName?: string;
  landedUrl?: string;
  text: string;
};

export type LinkPreviewOptions = {
  isPrivate?: boolean;
  isAgent?: boolean;
  blocked?: boolean;
};

export const LINK_PREVIEW_CACHE_LIMIT = 60;
export const LINK_PREVIEW_MAX_BYTES = 1_500_000;
export const LINK_PREVIEW_MAX_TEXT = 2500;

const RESERVED_SUFFIXES = [".localhost", ".local", ".lan", ".internal", ".home.arpa"];

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "vero_id",
  "yclid",
  "dclid",
  "_ga",
  "srsltid",
  "twclid",
  "li_fat_id",
]);

function isTrackingParam(name: string): boolean {
  return name.startsWith("utm_") || TRACKING_PARAMS.has(name);
}

export function stripTrackingParams(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  for (const name of [...url.searchParams.keys()]) {
    if (isTrackingParam(name)) url.searchParams.delete(name);
  }
  return url.toString();
}

function parseIPv4(host: string): number | null {
  if (/^0x[0-9a-f]+$/i.test(host)) {
    const value = Number.parseInt(host, 16);
    return Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff ? value : null;
  }
  if (/^\d+$/.test(host)) {
    const value = Number(host);
    return Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff ? value : null;
  }
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function expandIPv6(host: string): number[] | null {
  let text = host;
  const embedded = host.match(/:(\d+\.\d+\.\d+\.\d+)$/);
  if (embedded) {
    const v4 = parseIPv4(embedded[1]!);
    if (v4 === null) return null;
    text = host.slice(0, embedded.index) + `:${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const sides = text.split("::");
  if (sides.length > 2) return null;
  const parseSide = (side: string): number[] | null => {
    if (side === "") return [];
    const groups = side.split(":");
    const out: number[] = [];
    for (const group of groups) {
      if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
      out.push(Number.parseInt(group, 16));
    }
    return out;
  };
  const left = parseSide(sides[0]!);
  if (left === null) return null;
  if (sides.length === 1) {
    return left.length === 8 ? left : null;
  }
  const right = parseSide(sides[1]!);
  if (right === null) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;
  return [...left, ...new Array<number>(missing).fill(0), ...right];
}

function isReservedIPv4(value: number): boolean {
  const top = value >>> 24;
  return (
    top === 0 ||
    top === 10 ||
    top === 127 ||
    top >= 224 ||
    (value >>> 20) === 0xac1 ||
    (value >>> 16) === 0xc0a8 ||
    (value >>> 16) === 0xa9fe ||
    (value >>> 22) === 0x191 ||
    (value >>> 17) === 0x6309
  );
}

export function isReservedAddress(host: string): boolean {
  const v4 = parseIPv4(host);
  if (v4 !== null) return isReservedIPv4(v4);
  const v6 = expandIPv6(host);
  if (v6 === null) return false;
  const embedded = (v6[6]! << 16) | v6[7]!;
  if (v6.slice(0, 6).every((group) => group === 0)) return isReservedIPv4(embedded);
  if ((v6[0]! & 0xffc0) === 0xfe80) return true;
  if ((v6[0]! & 0xfe) === 0xfc) return true;
  if (v6[0]! === 0xff) return true;
  if (v6.slice(0, 5).every((group) => group === 0) && v6[5] === 0xffff) return isReservedIPv4(embedded);
  if (v6[0] === 0x0064 && v6[1] === 0xff9b && v6.slice(2, 6).every((group) => group === 0)) return isReservedIPv4(embedded);
  return false;
}

export function mayFetchLinkPreview(rawUrl: string, options: LinkPreviewOptions = {}): boolean {
  if (options.isPrivate || options.isAgent || options.blocked) return false;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  let host = url.hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  while (host.endsWith(".")) host = host.slice(0, -1);
  if (!host) return false;
  if (RESERVED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false;
  if (isReservedAddress(host)) return false;
  return host.includes(".") || host.includes(":");
}

const ENTITIES: [RegExp, string][] = [
  [/&amp;/g, "&"],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&#x27;/g, "'"],
  [/&apos;/g, "'"],
  [/&lt;/g, "<"],
  [/&gt;/g, ">"],
  [/&nbsp;/g, " "],
  [/&mdash;/g, "—"],
  [/&ndash;/g, "–"],
  [/&rsquo;/g, "’"],
  [/&lsquo;/g, "‘"],
  [/&ldquo;/g, "“"],
  [/&rdquo;/g, "”"],
  [/&hellip;/g, "…"],
];

export function cleanPreviewText(fragment: string): string {
  let text = fragment.replace(/<[^>]+>/g, " ");
  for (const [entity, character] of ENTITIES) text = text.replace(entity, character);
  text = text.replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)));
  text = text.replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));
  return text.replace(/\s+/g, " ").trim();
}

function firstMatch(pattern: RegExp, text: string): string | undefined {
  const match = new RegExp(pattern.source, pattern.flags.includes("i") ? pattern.flags : `${pattern.flags}i`).exec(text);
  return match?.[1];
}

function allMatches(pattern: RegExp, text: string): string[] {
  const regex = new RegExp(pattern.source, pattern.flags.includes("i") ? pattern.flags : `${pattern.flags}i`);
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[1] !== undefined) out.push(match[1]);
    if (match[0] === "") regex.lastIndex += 1;
  }
  return out;
}

function metaContent(head: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const value = firstMatch(pattern, head);
    if (value !== undefined) return cleanPreviewText(value);
  }
  return undefined;
}

function resolveHttpUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value, baseUrl);
  } catch {
    return undefined;
  }
  return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
}

export function extractLinkPreview(html: string, baseUrl: string): LinkPreviewPage {
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd >= 0 ? html.slice(0, headEnd) : html.slice(0, 60_000);
  const rawTitle = metaContent(head, "og:title") ?? firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/i, head);
  const title = rawTitle?.trim() ? cleanPreviewText(rawTitle) : undefined;
  const description = metaContent(head, "og:description") ?? metaContent(head, "description");
  const imageUrl = resolveHttpUrl(metaContent(head, "og:image") ?? metaContent(head, "twitter:image"), baseUrl);
  const icon =
    firstMatch(/<link\b[^>]*\brel\s*=\s*["'][^"']*\bicon\b[^"']*["'][^>]*\bhref\s*=\s*["']([^"']*)["']/i, head) ??
    firstMatch(/<link\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*\brel\s*=\s*["'][^"']*\bicon\b/i, head);
  const iconUrl = resolveHttpUrl(icon ? cleanPreviewText(icon) : undefined, baseUrl);
  const siteName = metaContent(head, "og:site_name");
  const body = html.replace(/<(script|style|noscript|svg|nav|footer|header)\b[\s\S]*?<\/\1>/gi, " ");
  let text = "";
  for (const paragraph of allMatches(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, body)) {
    const line = cleanPreviewText(paragraph);
    if (line.length < 40) continue;
    text += `${line}\n`;
    if (text.length >= LINK_PREVIEW_MAX_TEXT) break;
  }
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(iconUrl ? { iconUrl } : {}),
    ...(siteName ? { siteName } : {}),
    text: text.slice(0, LINK_PREVIEW_MAX_TEXT),
  };
}

export type PreviewFetch = (
  url: string,
  init: { redirect: "manual"; signal: AbortSignal },
) => Promise<{ status: number; headers: { get(name: string): string | null }; url: string; text: () => Promise<string> }>;

export type LinkPreviewState =
  | { status: "loading" }
  | { status: "ready"; page: LinkPreviewPage }
  | { status: "failed" };

export class LinkPreviewCache {
  private states = new Map<string, LinkPreviewState>();
  private order: string[] = [];

  get(url: string): LinkPreviewState | undefined {
    return this.states.get(url);
  }

  async load(rawUrl: string, fetchImpl: PreviewFetch, options: LinkPreviewOptions = {}): Promise<LinkPreviewState> {
    const existing = this.states.get(rawUrl);
    if (existing) return existing;
    const stripped = stripTrackingParams(rawUrl);
    if (!stripped || !mayFetchLinkPreview(stripped, options)) {
      const failed: LinkPreviewState = { status: "failed" };
      this.put(rawUrl, failed);
      return failed;
    }
    this.put(rawUrl, { status: "loading" });
    const page = await this.fetchPage(stripped, fetchImpl, options);
    const state: LinkPreviewState = page ? { status: "ready", page } : { status: "failed" };
    this.put(rawUrl, state);
    return state;
  }

  private put(url: string, state: LinkPreviewState) {
    if (!this.states.has(url)) {
      this.order.push(url);
      if (this.order.length > LINK_PREVIEW_CACHE_LIMIT) {
        const evicted = this.order.shift()!;
        this.states.delete(evicted);
      }
    }
    this.states.set(url, state);
  }

  private async fetchPage(startUrl: string, fetchImpl: PreviewFetch, options: LinkPreviewOptions): Promise<LinkPreviewPage | null> {
    let url = startUrl;
    for (let hop = 0; hop < 6; hop++) {
      if (!mayFetchLinkPreview(url, options)) return null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      let response: Awaited<ReturnType<PreviewFetch>>;
      try {
        response = await fetchImpl(url, { redirect: "manual", signal: controller.signal });
      } catch {
        clearTimeout(timeout);
        return null;
      } finally {
        clearTimeout(timeout);
      }
      if (response.status >= 300 && response.status < 400) {
        const next = response.headers.get("location");
        if (!next) return null;
        let resolved: string;
        try {
          resolved = new URL(next, url).toString();
        } catch {
          return null;
        }
        url = resolved;
        continue;
      }
      if (response.status < 200 || response.status >= 300) return null;
      let html: string;
      try {
        html = await response.text();
      } catch {
        return null;
      }
      if (new TextEncoder().encode(html).length > LINK_PREVIEW_MAX_BYTES) return null;
      const page = extractLinkPreview(html, response.url || url);
      return { ...page, landedUrl: response.url || url };
    }
    return null;
  }
}
