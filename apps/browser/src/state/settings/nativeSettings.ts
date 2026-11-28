import { setAppearance, setThinScrollBars } from "../../platform/app";
import { setAutoPictureInPicture, setVideoUpscaling } from "../../platform/media";
import { setCommandScrollZoom } from "../../platform/siteSettings";
import { setFingerprintProtection } from "../../platform/pageOptions";
import { everySlowly } from "../../platform/slowTimers";
import { useBrowser } from "../browser/store";
import { noteAppearanceScheduleSwitch } from "../telemetry/appearanceScheduleCounts";
import { effectiveAppearance } from "./appearanceSchedule";
import type { Settings } from "./settings";

type Mirror = { key: keyof Settings; value: (settings: Settings) => unknown; send: (settings: Settings) => unknown };

const mirror = <K extends keyof Settings>(
  key: K,
  send: (value: Settings[K]) => unknown,
  value: (settings: Settings) => Settings[K] = (settings) => settings[key],
): Mirror => ({ key, value, send: (settings) => send(value(settings)) });

const NATIVE_SETTINGS: Mirror[] = [
  mirror("appearance", setAppearance, (settings) => effectiveAppearance(settings)),
  mirror("pageScrollBars", (bars) => setThinScrollBars(bars === "thin")),
  mirror("autoPictureInPicture", setAutoPictureInPicture),
  mirror("videoUpscaling", setVideoUpscaling),
  mirror("commandScrollZoom", setCommandScrollZoom),
  mirror("fingerprintProtection", setFingerprintProtection),
];

let resync: (() => void) | null = null;

export function resyncNativeSettings() {
  resync?.();
}

export function startAppearanceSchedule() {
  everySlowly({
    every: 60_000,
    run: () => resyncNativeSettings(),
    needed: () => useBrowser.getState().settings.appearanceSchedule !== "off",
  });
}

export function startNativeSettings() {
  const sent = new Map<keyof Settings, unknown>();
  const sync = (settings: Settings) => {
    for (const { key, value, send } of NATIVE_SETTINGS) {
      const next = value(settings);
      if (sent.has(key) && sent.get(key) === next) continue;
      if (key === "appearance" && settings.appearanceSchedule !== "off" && sent.has(key)) noteAppearanceScheduleSwitch();
      sent.set(key, next);
      void send(settings);
    }
  };
  resync = () => sync(useBrowser.getState().settings);
  sync(useBrowser.getState().settings);
  return useBrowser.subscribe((s, prev) => s.settings !== prev.settings && sync(s.settings));
}
