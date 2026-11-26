import { boostsForHost, hostOf, newBoostId, type Boost } from "@universe/core";
import { useBrowser } from "../browser/store";
import { updateSettings } from "../settings/actions";
import { webviews } from "../tabs/webviewHandles";

const appliedTo = new Map<string, string>();

export function boostsOf(): Boost[] {
  return useBrowser.getState().settings.boosts;
}

export function addBoost(boost: Omit<Boost, "id">): Boost {
  const created: Boost = { ...boost, id: newBoostId() };
  updateSettings({ boosts: [...boostsOf(), created] });
  return created;
}

export function updateBoost(id: string, patch: Partial<Omit<Boost, "id">>) {
  updateSettings({ boosts: boostsOf().map((b) => (b.id === id ? { ...b, ...patch } : b)) });
}

export function removeBoost(id: string) {
  updateSettings({ boosts: boostsOf().filter((b) => b.id !== id) });
}

export function setBoostEnabled(id: string, enabled: boolean) {
  updateBoost(id, { enabled });
}

function injectionScript(boosts: Boost[]): string {
  const payload = JSON.stringify(boosts.map((b) => ({ id: b.id, css: b.css })));
  return `(() => { const boosts = ${payload}; const apply = () => { if (!document.documentElement) return; for (const b of boosts) { let el = document.querySelector('style[data-universe-boost="' + b.id + '"]'); if (!el) { el = document.createElement("style"); el.setAttribute("data-universe-boost", b.id); document.documentElement.appendChild(el); } el.textContent = b.css; } }; if (document.documentElement) apply(); else document.addEventListener("DOMContentLoaded", apply, { once: true }); })();`;
}

export function applyBoosts(tabId: string, url: string, force = false) {
  const key = url.split("#")[0]!;
  if (!force && appliedTo.get(tabId) === key) return;
  appliedTo.set(tabId, key);
  const host = hostOf(url);
  if (!host) return;
  const matches = boostsForHost(boostsOf(), host);
  if (!matches.length) return;
  void webviews.get(tabId)?.executeJavaScript(injectionScript(matches)).catch(() => undefined);
}

export function clearBoostState(tabId: string) {
  appliedTo.delete(tabId);
}
