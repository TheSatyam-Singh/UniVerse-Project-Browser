import { getZoomLevels, setZoom } from "../../platform/siteSettings";

export const ZOOM_LADDER = [0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.0;

export function clampZoom(zoom: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
}

export function nextZoomLevel(current: number, direction: "up" | "down"): number {
  if (direction === "up") return ZOOM_LADDER.find((level) => level > current + 0.01) ?? ZOOM_MAX;
  return [...ZOOM_LADDER].reverse().find((level) => level < current - 0.01) ?? ZOOM_MIN;
}

export function zoomPercentage(zoom: number): number {
  return Math.round(zoom * 100);
}

export async function applySiteZoom(profileId: string, host: string, zoom: number, isPrivate: boolean): Promise<number> {
  const clamped = clampZoom(zoom);
  if (isPrivate) {
    const key = hostKey(profileId, host);
    if (clamped === 1) privateZoomLevels.delete(key);
    else privateZoomLevels.set(key, clamped);
  } else {
    await setZoom(profileId, host, clamped);
  }
  return clamped;
}

export async function zoomInSite(profileId: string, host: string, current: number, isPrivate: boolean): Promise<number> {
  return applySiteZoom(profileId, host, nextZoomLevel(current, "up"), isPrivate);
}

export async function zoomOutSite(profileId: string, host: string, current: number, isPrivate: boolean): Promise<number> {
  return applySiteZoom(profileId, host, nextZoomLevel(current, "down"), isPrivate);
}

export async function resetSiteZoom(profileId: string, host: string, isPrivate: boolean): Promise<number> {
  return applySiteZoom(profileId, host, 1, isPrivate);
}

export async function restoreSiteZoom(profileId: string, host: string, isPrivate: boolean): Promise<number> {
  if (isPrivate) return privateZoomLevels.get(hostKey(profileId, host)) ?? 1;
  const levels = (await getZoomLevels(profileId)) as Record<string, number> | null;
  const level = levels?.[host];
  return typeof level === "number" && Number.isFinite(level) ? clampZoom(level) : 1;
}

const privateZoomLevels = new Map<string, number>();

function hostKey(profileId: string, host: string): string {
  return `${profileId}\n${host.toLowerCase()}`;
}

export function resetSiteZoomForTests() {
  privateZoomLevels.clear();
}
