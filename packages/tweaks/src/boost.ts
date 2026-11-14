import { normalizeSiteDomain } from "./siteRouting.ts";

export const BOOST_SCHEMA_VERSION = 1;
export const BOOST_MAX_CSS_BYTES = 64 * 1024;
export const BOOST_MAX_SCRIPT_BYTES = 64 * 1024;
export const BOOST_MAX_COUNT = 200;
export const BOOST_BUNDLE_MAX_BYTES = 2 * 1024 * 1024;

export type BoostTextCase = "none" | "uppercase" | "lowercase" | "capitalize";

export type Boost = {
  id: string;
  name: string;
  host: string;
  includeSubdomains: boolean;
  isEnabled: boolean;
  brightness: number;
  contrast: number;
  tint: string;
  tintStrength: number;
  darkPage: boolean;
  fontFamily: string;
  fontScale: number;
  textCase: BoostTextCase;
  css: string;
  zaps: string[];
  script: string;
  scriptEnabled: boolean;
  updated: number;
};

export const BOOST_BRIGHTNESS_RANGE = { min: 0.5, max: 1.5 };
export const BOOST_CONTRAST_RANGE = { min: 0.5, max: 1.5 };
export const BOOST_FONT_SCALE_RANGE = { min: 0.8, max: 2.0 };
export const BOOST_TINT_STRENGTH_RANGE = { min: 0.05, max: 0.8 };

export type BoostPreset = "dimPage" | "highContrast" | "largerType";

export function newBoost(host: string, id?: string): Boost {
  return {
    id: id ?? `boost-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    host: normalizeBoostHost(host),
    includeSubdomains: true,
    isEnabled: true,
    brightness: 1,
    contrast: 1,
    tint: "",
    tintStrength: 0.35,
    darkPage: false,
    fontFamily: "",
    fontScale: 1,
    textCase: "none",
    css: "",
    zaps: [],
    script: "",
    scriptEnabled: false,
    updated: Date.now(),
  };
}

export function normalizeBoostHost(input: string): string {
  const host = normalizeSiteDomain(input);
  if (!host || !host.includes(".") || host.startsWith(".") || host.endsWith(".")) return "";
  for (const ch of host) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 127) continue;
    if (!/[a-z0-9.-]/.test(ch)) return "";
  }
  return host;
}

export function boostMatches(boost: Boost, url: string): boolean {
  if (!boost.isEnabled || !boost.host) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const pageHost = parsed.hostname.toLowerCase();
  return pageHost === boost.host || (boost.includeSubdomains && pageHost.endsWith(`.${boost.host}`));
}

export function matchingBoosts(url: string, boosts: Boost[]): Boost[] {
  return boosts.filter((b) => boostMatches(b, url));
}

export function isHexColor(s: string): boolean {
  return s.length === 7 && s.startsWith("#") && [...s.slice(1)].every((c) => /[0-9a-fA-F]/.test(c));
}

export function isAllowedZap(selector: string): boolean {
  const s = selector.trim();
  if (!s || s.length > 500) return false;
  if (s.replace(/\\/g, "").toLowerCase().includes("player-ads")) return false;
  if (s.includes("##") || s.includes("#@#") || s.includes("#?#")) return false;
  return ![...s].some((c) => "{};\\\n\r".includes(c));
}

export function removingBaitRules(css: string): string {
  if (!css.replace(/\\/g, "").toLowerCase().includes("player-ads")) return css;
  const parts = css.split("}");
  const kept: string[] = [];
  parts.forEach((part, i) => {
    if (part.replace(/\\/g, "").toLowerCase().includes("player-ads")) return;
    kept.push(i < parts.length - 1 ? `${part}}` : part);
  });
  return kept.join("").trim();
}

function boostNum(v: number): string {
  return Math.min(Math.max(v, 0), 10).toFixed(2);
}

function safeFont(s: string): string {
  return [...s].filter((c) => /[a-zA-Z0-9 ,\-'"]/.test(c)).join("").trim();
}

export function compiledBoostCss(boost: Boost): string {
  const rules: string[] = [];
  const filters: string[] = [];
  if (boost.darkPage) filters.push("invert(1) hue-rotate(180deg)");
  if (boost.brightness !== 1) filters.push(`brightness(${boostNum(boost.brightness)})`);
  if (boost.contrast !== 1) filters.push(`contrast(${boostNum(boost.contrast)})`);
  if (filters.length > 0) {
    const f = filters.join(" ");
    rules.push(
      `html::before { content: "" !important; display: block !important; position: fixed !important; inset: 0 !important; pointer-events: none !important; z-index: 2147483646 !important; -webkit-backdrop-filter: ${f}; backdrop-filter: ${f}; }`,
    );
  }
  if (boost.darkPage) {
    rules.push(":where(html) { background-color: #fff; }");
    rules.push(
      ":is(img, video, picture, canvas, iframe, embed, object, svg image):not(:fullscreen, :fullscreen *, dialog[open] *, :popover-open *) { filter: invert(1) hue-rotate(180deg) !important; }",
    );
  }
  if (isHexColor(boost.tint)) {
    const strength = boostNum(
      Math.min(Math.max(boost.tintStrength, BOOST_TINT_STRENGTH_RANGE.min), BOOST_TINT_STRENGTH_RANGE.max),
    );
    rules.push(
      `html::after { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; background: ${boost.tint}; mix-blend-mode: color; opacity: ${strength}; }`,
    );
  }
  const text = "p, span, a, li, h1, h2, h3, h4, h5, h6, td, th, label, button, input, textarea, blockquote";
  const font = safeFont(boost.fontFamily);
  if (font) rules.push(`html, body, ${text} { font-family: ${font} !important; }`);
  if (boost.fontScale !== 1) {
    rules.push(`html { font-size: ${Math.round(Math.min(Math.max(boost.fontScale, 0.5), 3) * 100)}% !important; }`);
  }
  if (boost.textCase !== "none") rules.push(`${text} { text-transform: ${boost.textCase} !important; }`);
  for (const selector of boost.zaps) {
    if (isAllowedZap(selector)) rules.push(`${selector} { display: none !important; }`);
  }
  const own = removingBaitRules(boost.css);
  if (own) rules.push(own);
  return rules.join("\n");
}

export function boostCssFor(url: string, boosts: Boost[]): string {
  return matchingBoosts(url, boosts)
    .map(compiledBoostCss)
    .filter((css) => css.length > 0)
    .join("\n");
}

export function zapFilterLines(boosts: Boost[]): string[] {
  return boosts
    .filter((b) => b.isEnabled && b.host)
    .flatMap((b) => b.zaps.filter(isAllowedZap).map((z) => `${b.host}##${z}`));
}

export function applyBoostPreset(boost: Boost, preset: BoostPreset): Boost {
  const next: Boost = { ...boost, brightness: 1, contrast: 1, fontScale: 1, tint: "", updated: Date.now() };
  if (preset === "dimPage") next.brightness = 0.8;
  if (preset === "highContrast") next.contrast = 1.3;
  if (preset === "largerType") next.fontScale = 1.2;
  return next;
}

export function resetBoostVisuals(boost: Boost): Boost {
  return {
    ...boost,
    brightness: 1,
    contrast: 1,
    tint: "",
    darkPage: false,
    fontFamily: "",
    fontScale: 1,
    textCase: "none",
    updated: Date.now(),
  };
}

export function stripRemoteCss(css: string): string {
  let out = css.replace(/\\/g, "");
  out = out.replace(/@import[^;{]*;?/gi, "");
  out = out.replace(/url\s*\([^)]*\)?/gi, "");
  return out;
}

export type BoostBundleFailure = { message: string };

export function exportBoosts(boosts: Boost[]): string {
  return JSON.stringify({ schema: BOOST_SCHEMA_VERSION, boosts }, null, 2);
}

export function parseBoostBundle(data: string): { boosts: Boost[] } | BoostBundleFailure {
  if (data.length > BOOST_BUNDLE_MAX_BYTES) return { message: "The file is larger than 2 MB." };
  let file: unknown;
  try {
    file = JSON.parse(data);
  } catch {
    return { message: "This is not a UniVerse Boost file." };
  }
  if (!file || typeof file !== "object" || !Array.isArray((file as { boosts?: unknown }).boosts)) {
    return { message: "This is not a UniVerse Boost file." };
  }
  const parsed = file as { schema?: unknown; boosts: unknown[] };
  if (typeof parsed.schema === "number" && parsed.schema > BOOST_SCHEMA_VERSION) {
    return { message: "This file was made by a newer version of UniVerse Project Browser." };
  }
  if (parsed.boosts.length > BOOST_MAX_COUNT) return { message: "Too many Boosts in one file." };
  const boosts: Boost[] = [];
  for (const raw of parsed.boosts) {
    const decoded = decodeBoost(raw);
    if (!decoded) return { message: "A Boost has an invalid site." };
    boosts.push(decoded);
  }
  return { boosts };
}

export function parseBoostsLossy(raw: unknown): Boost[] {
  if (!Array.isArray(raw)) return [];
  const out: Boost[] = [];
  for (const item of raw) {
    const decoded = decodeBoost(item);
    if (decoded) out.push(decoded);
  }
  return out;
}

function decodeBoost(raw: unknown): Boost | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.host !== "string") return null;
  const host = normalizeBoostHost(v.host);
  if (!host) return null;
  if (typeof v.css === "string" && v.css.length > BOOST_MAX_CSS_BYTES) return null;
  if (typeof v.script === "string" && v.script.length > BOOST_MAX_SCRIPT_BYTES) return null;
  const base = newBoost(host);
  return {
    ...base,
    name: typeof v.name === "string" ? v.name : "",
    includeSubdomains: typeof v.includeSubdomains === "boolean" ? v.includeSubdomains : true,
    isEnabled: typeof v.isEnabled === "boolean" ? v.isEnabled : true,
    brightness: typeof v.brightness === "number" ? v.brightness : 1,
    contrast: typeof v.contrast === "number" ? v.contrast : 1,
    tint: typeof v.tint === "string" ? v.tint : "",
    tintStrength: typeof v.tintStrength === "number" ? v.tintStrength : 0.35,
    darkPage: v.darkPage === true,
    fontFamily: typeof v.fontFamily === "string" ? v.fontFamily : "",
    fontScale: typeof v.fontScale === "number" ? v.fontScale : 1,
    textCase: v.textCase === "uppercase" || v.textCase === "lowercase" || v.textCase === "capitalize" ? v.textCase : "none",
    css: typeof v.css === "string" ? removingBaitRules(stripRemoteCss(v.css)) : "",
    zaps: Array.isArray(v.zaps) ? v.zaps.filter((z): z is string => typeof z === "string").filter(isAllowedZap) : [],
    script: typeof v.script === "string" ? v.script : "",
    scriptEnabled: false,
    updated: typeof v.updated === "number" ? v.updated : Date.now(),
  };
}
