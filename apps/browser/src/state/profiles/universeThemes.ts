import { DEFAULT_THEME_ANGLE, hexColor, type ProfileTheme, type ThemeLook, type ThemeStop } from "../../lib/profileLook";

export type UniverseThemePreset = { id: string; name: string; theme: ProfileTheme };

function stop(hex: string, x: number, y: number): ThemeStop {
  return { x, y, color: hexColor(hex) };
}

function look(hexes: [string, string, string], intensity = 0.6): ThemeLook {
  return {
    stops: [stop(hexes[0], 0.25, 0.2), stop(hexes[1], 0.7, 0.55), stop(hexes[2], 0.45, 0.85)],
    intensity,
    grain: 0,
    texture: "grain",
    translucency: 1,
    angle: DEFAULT_THEME_ANGLE,
  };
}

function preset(id: string, name: string, light: [string, string, string], dark: [string, string, string]): UniverseThemePreset {
  return { id, name, theme: { ...look(light), mode: "auto", dark: look(dark) } };
}

export const UNIVERSE_THEMES: readonly UniverseThemePreset[] = [
  preset("universe-indigo", "UniVerse Indigo", ["#6366F1", "#8B5CF6", "#312E81"], ["#1E1B4B", "#4C1D95", "#312E81"]),
  preset("nebula-violet", "Nebula Violet", ["#7C3AED", "#C026D3", "#A855F7"], ["#2E1065", "#6B21A8", "#4C1D95"]),
  preset("event-horizon", "Event Horizon", ["#E0E7FF", "#818CF8", "#1E1B4B"], ["#0B0B14", "#312E81", "#6D28D9"]),
  preset("stardust", "Stardust", ["#F5F3FF", "#DDD6FE", "#C7D2FE"], ["#1E1B4B", "#3730A3", "#6D28D9"]),
  preset("deep-space", "Deep Space", ["#1E3A8A", "#3730A3", "#6D28D9"], ["#0A0A1F", "#1E1B4B", "#3730A3"]),
];

export function universeThemeById(id: string): UniverseThemePreset | undefined {
  return UNIVERSE_THEMES.find((preset) => preset.id === id);
}
