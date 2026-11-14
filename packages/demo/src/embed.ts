import { startCustomize, watchCustomize, type CustomizeState } from "./customizeFlow";
import { playNudge } from "./nudge";
import { prefersReducedMotion } from "./shims/web/gl/clock";
import { powerUpFragment } from "./shims/web/gl/sources";
import { prewarmSurfaces } from "./shims/web/gl/surface";
import { APP_DOWNLOAD_EVENT } from "./shims/webDemo";

const PREWARM_WAIT_MS = 3000;

const whenIdle = (run: () => void) =>
  "requestIdleCallback" in window ? requestIdleCallback(run, { timeout: PREWARM_WAIT_MS }) : setTimeout(run, PREWARM_WAIT_MS);

type Inbound = { type: "universe-demo:customize" } | { type: "universe-demo:hello" } | { type: "universe-demo:nudge" };

function guardFocus(engaged: () => boolean) {
  const focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function guardedFocus(options?: FocusOptions) {
    if (!engaged()) return;
    focus.call(this, { ...options, preventScroll: true });
  };
}

const LOCAL_SITE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const isOurSite = (origin: string) => origin === location.origin || (import.meta.env.DEV && LOCAL_SITE.test(origin));

function siteOrigin() {
  const candidates = [location.ancestorOrigins?.[0], document.referrer ? new URL(document.referrer).origin : undefined];
  return candidates.find((origin): origin is string => !!origin && isOurSite(origin)) ?? null;
}

export function startEmbed() {
  const host = window.parent;
  if (host === window) return;
  const origin = siteOrigin();
  if (!origin) return;
  document.documentElement.classList.add("embed");

  const post = (message: object) => host.postMessage(message, origin);
  let engaged = false;
  let nudged = false;
  let ready = false;
  const nudge = new AbortController();
  const engage = () => {
    if (engaged) return;
    engaged = true;
    nudge.abort();
    post({ type: "universe-demo:engaged" });
  };
  guardFocus(() => engaged);
  addEventListener("pointerdown", engage, { capture: true });
  addEventListener("keydown", engage, { capture: true });

  let state: CustomizeState = { active: false, code: null };
  const publish = () => post({ type: "universe-demo:customize-state", ...state });
  watchCustomize((next) => {
    state = next;
    publish();
  });

  addEventListener(APP_DOWNLOAD_EVENT, () => post({ type: "universe-demo:download" }));

  addEventListener("message", (event: MessageEvent<Inbound>) => {
    if (event.source !== host || event.origin !== origin || !event.data || typeof event.data !== "object") return;
    if (event.data.type === "universe-demo:hello") {
      publish();
      if (ready) post({ type: "universe-demo:ready" });
      return;
    }
    if (event.data.type === "universe-demo:nudge") {
      if (engaged || nudged) return;
      nudged = true;
      void playNudge(nudge.signal);
      return;
    }
    if (event.data.type === "universe-demo:customize") {
      engage();
      startCustomize();
    }
  });

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      ready = true;
      publish();
      post({ type: "universe-demo:ready" });
      if (!prefersReducedMotion()) whenIdle(() => prewarmSurfaces([powerUpFragment]));
    }),
  );
}
