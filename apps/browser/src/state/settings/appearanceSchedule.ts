import type { Settings } from "./settings";

export type AppearanceScheduleSettings = Pick<
  Settings,
  "appearanceSchedule" | "appearanceScheduleStart" | "appearanceScheduleEnd" | "appearanceScheduleLatitude" | "appearanceScheduleLongitude"
>;

const DEG = Math.PI / 180;
const sinDeg = (d: number) => Math.sin(d * DEG);
const cosDeg = (d: number) => Math.cos(d * DEG);
const tanDeg = (d: number) => Math.tan(d * DEG);
const asinDeg = (x: number) => Math.asin(x) / DEG;
const acosDeg = (x: number) => Math.acos(x) / DEG;
const atanDeg = (x: number) => Math.atan(x) / DEG;
const normalize360 = (d: number) => ((d % 360) + 360) % 360;
const normalize24 = (h: number) => ((h % 24) + 24) % 24;

export function parseTimeOfDay(value: string): number | null {
  const match = /^\s*(\d{1,2}):(\d{1,2})\s*$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatTimeOfDay(minutes: number): string {
  const clamped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

export function isDarkInWindow(nowMinutes: number, startMinutes: number, endMinutes: number): boolean {
  if (startMinutes === endMinutes) return false;
  return startMinutes < endMinutes ? nowMinutes >= startMinutes && nowMinutes < endMinutes : nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export type SunTimes = { sunrise: number; sunset: number } | "polarDay" | "polarNight";

export function sunTimes(date: Date, latitude: number, longitude: number): SunTimes | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const dayOfYear = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 86_400_000);
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const tzHours = -noon.getTimezoneOffset() / 60;
  const lngHour = longitude / 15;
  const event = (rising: boolean): number | "polarDay" | "polarNight" => {
    const t = dayOfYear + ((rising ? 6 : 18) - lngHour) / 24;
    const m = 0.9856 * t - 3.289;
    const l = normalize360(m + 1.916 * sinDeg(m) + 0.02 * sinDeg(2 * m) + 282.634);
    const ra = normalize360(atanDeg(0.91764 * tanDeg(l)));
    const raAdjusted = ra + (Math.floor(l / 90) * 90 - Math.floor(ra / 90) * 90);
    const sinDec = 0.39782 * sinDeg(l);
    const cosDec = cosDeg(asinDeg(sinDec));
    const cosH = (cosDeg(90.833) - sinDec * sinDeg(latitude)) / (cosDec * cosDeg(latitude));
    if (cosH > 1) return "polarNight";
    if (cosH < -1) return "polarDay";
    const hHours = (rising ? 360 - acosDeg(cosH) : acosDeg(cosH)) / 15;
    return normalize24(hHours + raAdjusted / 15 - 0.06571 * t - 6.622 - lngHour + tzHours) * 60;
  };
  const sunrise = event(true);
  const sunset = event(false);
  if (sunrise === "polarNight" || sunset === "polarNight") return "polarNight";
  if (sunrise === "polarDay" || sunset === "polarDay") return "polarDay";
  return { sunrise, sunset };
}

export function scheduledAppearance(settings: AppearanceScheduleSettings, now = new Date()): "light" | "dark" | null {
  if (settings.appearanceSchedule === "off") return null;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (settings.appearanceSchedule === "custom") {
    const start = parseTimeOfDay(settings.appearanceScheduleStart);
    const end = parseTimeOfDay(settings.appearanceScheduleEnd);
    if (start === null || end === null) return null;
    return isDarkInWindow(nowMinutes, start, end) ? "dark" : "light";
  }
  const { appearanceScheduleLatitude: latitude, appearanceScheduleLongitude: longitude } = settings;
  if (latitude === null || longitude === null) return null;
  const times = sunTimes(now, latitude, longitude);
  if (times === null) return null;
  if (times === "polarDay") return "light";
  if (times === "polarNight") return "dark";
  if (times.sunset < times.sunrise) return nowMinutes >= times.sunrise || nowMinutes < times.sunset ? "light" : "dark";
  return nowMinutes < times.sunrise || nowMinutes >= times.sunset ? "dark" : "light";
}

export function effectiveAppearance(
  settings: AppearanceScheduleSettings & Pick<Settings, "appearance">,
  now = new Date(),
): Settings["appearance"] {
  return scheduledAppearance(settings, now) ?? settings.appearance;
}
