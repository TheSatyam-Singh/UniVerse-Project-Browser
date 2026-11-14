import { create } from "zustand";
import { readDocument, writeDocument } from "../../platform/documents";
import { useBrowser } from "../browser/store";
import {
  defaultSponsorBlockCategoryOptions,
  defaultTweaksSettings,
  parseTweaksSettings,
  tweaksSettingsJson,
  type SiteRoutingRule,
  type SponsorBlockCategoryOptions,
  type TweaksSettings,
} from "@universe/tweaks";

export const TWEAKS_DOC = "tweaks.json";
export type { SiteRoutingRule, TweaksSettings };

type Store = { loaded: boolean; settings: TweaksSettings };

export const useTweaks = create<Store>()(() => ({ loaded: false, settings: defaultTweaksSettings() }));

function read(doc: string): string | null {
  try {
    return readDocument(doc);
  } catch {
    return null;
  }
}

function write(doc: string, json: string): boolean {
  try {
    writeDocument(doc, json);
    return true;
  } catch (error) {
    console.warn(`[tweaks] couldn't save ${doc}`, error);
    return false;
  }
}

export function loadTweaks() {
  if (useTweaks.getState().loaded) return;
  useTweaks.setState({ loaded: true, settings: parseTweaksSettings(read(TWEAKS_DOC)) });
}

export function sponsorBlockFromSettings(): { sponsorBlockEnabled: boolean; sponsorBlockCategoryOptions: SponsorBlockCategoryOptions } {
  const settings = useBrowser.getState().settings;
  const defaults = defaultSponsorBlockCategoryOptions();
  const options: SponsorBlockCategoryOptions = { ...defaults };
  for (const [category, value] of Object.entries(settings.sponsorBlockCategories)) {
    if (category in defaults && (value === "auto" || value === "manual" || value === "disabled")) options[category] = value;
  }
  return { sponsorBlockEnabled: settings.sponsorBlockEnabled, sponsorBlockCategoryOptions: options };
}

export function currentTweaks(): TweaksSettings {
  loadTweaks();
  return { ...useTweaks.getState().settings, ...sponsorBlockFromSettings() };
}

export function resetTweaksForTests(settings?: TweaksSettings) {
  useTweaks.setState({ loaded: true, settings: settings ?? defaultTweaksSettings() });
}

function saveSettings(change: (settings: TweaksSettings) => TweaksSettings) {
  const before = currentTweaks();
  const settings = change(before);
  if (settings === before) return;
  const sponsorBlockChanged =
    settings.sponsorBlockEnabled !== before.sponsorBlockEnabled ||
    JSON.stringify(settings.sponsorBlockCategoryOptions) !== JSON.stringify(before.sponsorBlockCategoryOptions);
  if (sponsorBlockChanged) {
    useBrowser.getState().updateSettings({
      sponsorBlockEnabled: settings.sponsorBlockEnabled,
      sponsorBlockCategories: { ...settings.sponsorBlockCategoryOptions },
    });
  }
  const stored = { ...settings, ...sponsorBlockFromSettings() };
  const doc = JSON.parse(tweaksSettingsJson(stored)) as Record<string, unknown>;
  delete doc.sponsorBlockEnabled;
  delete doc.sponsorBlockCategoryOptions;
  if (!write(TWEAKS_DOC, JSON.stringify(doc))) return;
  useTweaks.setState({ settings: stored });
}

export function updateTweaks(patch: Partial<TweaksSettings>) {
  saveSettings((settings) => ({ ...settings, ...patch }));
}

export function updateTweaksSection<K extends keyof TweaksSettings>(key: K, patch: Partial<TweaksSettings[K]>) {
  saveSettings((settings) => ({ ...settings, [key]: { ...(settings[key] as object), ...patch } }));
}

export function setSponsorBlockCategory(category: string, option: "auto" | "manual" | "disabled") {
  saveSettings((settings) => ({
    ...settings,
    sponsorBlockCategoryOptions: { ...settings.sponsorBlockCategoryOptions, [category]: option },
  }));
}

export function setAllowUniverseLinks(allowed: boolean) {
  updateTweaks({ allowUniverseLinks: allowed });
}
