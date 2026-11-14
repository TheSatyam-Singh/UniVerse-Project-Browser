import { TWEAK_SCRIPTS } from "@universe/tweaks";

export type PipVideo = {
  playing: boolean;
  muted: boolean;
  volume: number;
  loop: boolean;
  width: number;
  height: number;
};

export type PipReturnContext = {
  tabWindowId: string | undefined;
  activate: (tabId: string) => void;
  focusWindow: (windowId: string) => void;
};

export function allowsAutomaticPiP(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return false;
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return false;
  if ((host === "youtube.com" || host.endsWith(".youtube.com")) && parsed.pathname.startsWith("/shorts")) return false;
  return true;
}

export function refusesAutomaticVideo(video: PipVideo): boolean {
  return !video.playing || video.muted || video.volume === 0 || video.loop || video.height > video.width;
}

export function pickPipVideoScript(): string {
  return TWEAK_SCRIPTS.pipPicker;
}

export function returnToPipTab(tabId: string, ctx: PipReturnContext): boolean {
  if (!ctx.tabWindowId) return false;
  ctx.activate(tabId);
  ctx.focusWindow(ctx.tabWindowId);
  return true;
}
