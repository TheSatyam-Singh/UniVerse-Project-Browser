import { colorHex, fromOklab, hexColor, oklab, type ProfileTheme, type ThemeColor, type ThemeStop } from "../../lib/profileLook";
import { isHexColor } from "../../lib/color";
import type { ThemeTexture } from "@universe/core";

export type SpaceThemeMode = "auto" | "light" | "dark";
export type SpaceThemeWheel = "analogous" | "complementary";
export type SpaceThemeOverlay = "grain" | "sand" | "denim" | "tweed";

export type SpaceThemePoint = { x: number; y: number };

export type SpaceTheme = {
  points: SpaceThemePoint[];
  mode: SpaceThemeMode;
  intensity: number;
  grain: number;
  wheel: SpaceThemeWheel;
  overlay: SpaceThemeOverlay;
  tone?: number;
  colorCount: number;
};

export const SPACE_THEME_MAX_POINTS = 3;
export const SPACE_THEME_ACCENT_CHROMA = 0.16;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const clampPoint = (p: SpaceThemePoint): SpaceThemePoint => ({ x: clamp01(p.x), y: clamp01(p.y) });

export const spaceThemePointCenter: SpaceThemePoint = { x: 0.5, y: 0.5 };

export function spaceThemePoint(hue: number, saturation: number): SpaceThemePoint {
  const radians = (hue * Math.PI) / 180;
  const r = clamp01(saturation) * 0.5;
  return clampPoint({ x: 0.5 + r * Math.cos(radians), y: 0.5 - r * Math.sin(radians) });
}

export function pointHue(p: SpaceThemePoint): number {
  const degrees = (Math.atan2(0.5 - p.y, p.x - 0.5) * 180) / Math.PI;
  return degrees < 0 ? degrees + 360 : degrees;
}

export function pointSaturation(p: SpaceThemePoint): number {
  return Math.min(1, Math.hypot(p.x - 0.5, p.y - 0.5) / 0.5);
}

export function spaceThemeHues(key: number, count: number, wheel: SpaceThemeWheel): number[] {
  let offsets: number[];
  if (count <= 1) offsets = [0];
  else if (count === 2 && wheel === "analogous") offsets = [0, 40];
  else if (count === 2) offsets = [0, 180];
  else if (count === 3 && wheel === "analogous") offsets = [0, 40, -40];
  else if (count === 3) offsets = [0, 150, 210];
  else offsets = Array.from({ length: count }, (_, i) => (i * 360) / count);
  return offsets.map((offset) => {
    const h = (key + offset) % 360;
    return h < 0 ? h + 360 : h;
  });
}

export function spaceThemeLightnessRange(mode: SpaceThemeMode): [number, number] {
  if (mode === "light") return [0.575, 0.97];
  if (mode === "dark") return [0.01, 0.425];
  return [0.01, 0.97];
}

export function clampSpaceThemeLightness(lightness: number, mode: SpaceThemeMode): number {
  const [lo, hi] = spaceThemeLightnessRange(mode);
  return Math.min(hi, Math.max(lo, lightness));
}

export function syncSpaceThemePoints(theme: SpaceTheme): SpaceThemePoint[] {
  const key = theme.points[0] ?? spaceThemePointCenter;
  const count = Math.min(SPACE_THEME_MAX_POINTS, Math.max(1, theme.colorCount));
  const hues = spaceThemeHues(pointHue(key), count, theme.wheel);
  return [key, ...hues.slice(1).map((h) => spaceThemePoint(h, pointSaturation(key)))];
}

export function newSpaceTheme(points: SpaceThemePoint[], over: Partial<SpaceTheme> = {}): SpaceTheme {
  const key = points[0] ?? spaceThemePointCenter;
  const theme: SpaceTheme = {
    points: [key],
    mode: over.mode ?? "auto",
    intensity: clamp01(over.intensity ?? 0.6),
    grain: clamp01(over.grain ?? 0),
    wheel: over.wheel ?? "analogous",
    overlay: over.overlay ?? "grain",
    ...(over.tone !== undefined ? { tone: clamp01(over.tone) } : {}),
    colorCount: Math.min(SPACE_THEME_MAX_POINTS, Math.max(1, over.colorCount ?? points.length)),
  };
  return { ...theme, points: syncSpaceThemePoints(theme) };
}

export function spaceThemeFromAccent(accentHex: string): SpaceTheme {
  if (!isHexColor(accentHex)) return newSpaceTheme([spaceThemePointCenter]);
  const hex = hexColor(accentHex);
  if (![hex.r, hex.g, hex.b].every(Number.isFinite)) return newSpaceTheme([spaceThemePointCenter]);
  const [, a, b] = oklab(hex);
  const hue = (Math.atan2(b, a) * 180) / Math.PI;
  const chroma = Math.hypot(a, b);
  return newSpaceTheme([spaceThemePoint(hue < 0 ? hue + 360 : hue, chroma / SPACE_THEME_ACCENT_CHROMA)]);
}

type Oklch = { l: number; c: number; h: number };

function oklchToRgb({ l, c, h }: Oklch): ThemeColor {
  const radians = (h * Math.PI) / 180;
  const inGamut = (rgb: [number, number, number]): boolean =>
    rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
  const atChroma = (chroma: number): [number, number, number] => {
    const aa = chroma * Math.cos(radians);
    const bb = chroma * Math.sin(radians);
    return fromOklab([l, aa, bb]);
  };
  let best = atChroma(0);
  if (inGamut(atChroma(c))) return toThemeColor(atChroma(c));
  let low = 0;
  let high = c;
  for (let i = 0; i < 16; i++) {
    const mid = (low + high) / 2;
    const candidate = atChroma(mid);
    if (inGamut(candidate)) {
      best = candidate;
      low = mid;
    } else high = mid;
  }
  return toThemeColor(best);
}

function toThemeColor(rgb: [number, number, number]): ThemeColor {
  return { r: clamp01(rgb[0]), g: clamp01(rgb[1]), b: clamp01(rgb[2]), a: 1 };
}

function chromeOklch(p: SpaceThemePoint, dark: boolean, strength: number, tone?: number): Oklch {
  const s = pointSaturation(p) * strength;
  let l = dark ? 0.21 + 0.17 * s : 0.955 - 0.11 * s;
  if (tone !== undefined) {
    const neutral = dark ? 0.21 : 0.955;
    const target = dark ? 0.12 + 0.3 * tone : 0.8 + 0.17 * tone;
    l = neutral + (target - neutral) * strength;
  }
  return { l: clampSpaceThemeLightness(l, dark ? "dark" : "light"), c: dark ? 0.13 * s : 0.11 * s, h: pointHue(p) };
}

export type ResolvedSpaceTheme = {
  stops: ThemeColor[];
  accent: ThemeColor;
  isDark: boolean;
  grain: number;
  overlay: SpaceThemeOverlay;
};

export function spaceThemeIsDark(theme: SpaceTheme, systemDark: boolean): boolean {
  if (theme.mode === "light") return false;
  if (theme.mode === "dark") return true;
  return systemDark;
}

export function resolveSpaceTheme(theme: SpaceTheme, systemDark: boolean, dimmed = false): ResolvedSpaceTheme {
  const dark = spaceThemeIsDark(theme, systemDark);
  const strength = (0.25 + 0.75 * theme.intensity) * (dimmed ? 0.55 : 1);
  const points = syncSpaceThemePoints(theme);
  let stops = points.map((p) => oklchToRgb(chromeOklch(p, dark, strength, theme.tone)));
  if (stops.length === 1) {
    const only = stops[0]!;
    const [l, a, b] = oklab(only);
    const up = fromOklab([Math.min(1, l + 0.025), a, b]);
    const down = fromOklab([Math.max(0, l - 0.02), a, b]);
    stops = [toThemeColor(up), toThemeColor(down)];
  }
  return {
    stops,
    accent: oklchToRgb({ l: 0.64, c: SPACE_THEME_ACCENT_CHROMA * pointSaturation(points[0]!), h: pointHue(points[0]!) }),
    isDark: dark,
    grain: theme.grain,
    overlay: theme.overlay,
  };
}

export function spaceThemePuckColor(p: SpaceThemePoint, dark: boolean): ThemeColor {
  const s = pointSaturation(p);
  return oklchToRgb({ l: dark ? 0.12 + 0.56 * s : 0.99 - 0.27 * s, c: 0.17 * s, h: pointHue(p) });
}

export function spaceThemeSwatchColor(p: SpaceThemePoint): ThemeColor {
  return oklchToRgb({ l: 0.95 - 0.2 * pointSaturation(p), c: 0.14 * pointSaturation(p), h: pointHue(p) });
}

export type SpaceThemeTileColors = { fill: string; hoverFill: string; selectedFill: string; selectedBorder: string };

function mix(a: ThemeColor, b: ThemeColor, t: number): ThemeColor {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 };
}

export function spaceThemeTileColors(chrome: ThemeColor, dark: boolean): SpaceThemeTileColors {
  const white: ThemeColor = { r: 1, g: 1, b: 1, a: 1 };
  const black: ThemeColor = { r: 0, g: 0, b: 0, a: 1 };
  if (dark) {
    const selected = mix(chrome, white, 0.18);
    return {
      fill: colorHex(mix(chrome, white, 0.07)),
      hoverFill: colorHex(mix(chrome, white, 0.12)),
      selectedFill: colorHex(selected),
      selectedBorder: colorHex(mix(selected, white, 0.14)),
    };
  }
  const selected = mix(chrome, white, 0.36);
  return {
    fill: colorHex(mix(chrome, black, 0.054)),
    hoverFill: colorHex(mix(chrome, selected, 0.5)),
    selectedFill: colorHex(selected),
    selectedBorder: colorHex(mix(selected, black, 0.2)),
  };
}

export function spaceThemeToProfileTheme(theme: SpaceTheme): ProfileTheme {
  const points = syncSpaceThemePoints(theme);
  const toStops = (resolved: ResolvedSpaceTheme): ThemeStop[] =>
    points.map((p, i) => ({ color: resolved.stops[i] ?? resolved.stops[0]!, x: clamp01(p.x), y: clamp01(1 - p.y) }));
  const light = resolveSpaceTheme(theme, false);
  const dark = resolveSpaceTheme(theme, true);
  const texture: ThemeTexture = theme.overlay;
  return {
    stops: toStops(light),
    intensity: theme.intensity,
    grain: theme.grain,
    texture,
    translucency: 1,
    mode: theme.mode,
    dark: { stops: toStops(dark), intensity: theme.intensity, grain: theme.grain, texture, translucency: 1 },
  };
}

export function profileThemeToSpaceTheme(theme: ProfileTheme): SpaceTheme {
  const points = theme.stops.slice(0, SPACE_THEME_MAX_POINTS).map((s) => clampPoint({ x: s.x, y: 1 - s.y }));
  return newSpaceTheme(points.length ? points : [spaceThemePointCenter], {
    mode: theme.mode,
    intensity: theme.intensity,
    grain: theme.grain,
    overlay: theme.texture,
    colorCount: points.length || 1,
  });
}
