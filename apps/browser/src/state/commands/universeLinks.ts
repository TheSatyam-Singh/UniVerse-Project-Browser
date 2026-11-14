export type UniverseLinkAction =
  | { kind: "open"; url: string; reuse: boolean }
  | { kind: "search"; query: string }
  | { kind: "switchSpace" };

export type UniverseLinkCommand = {
  action: UniverseLinkAction;
  space?: string;
  ignored: string[];
};

export type UniverseSpace = { id: string; name: string };
export type UniverseTab = { id: string; url: string; profileId: string; windowId: string };

export type UniverseLinkContext = {
  allowed: boolean;
  spaces: UniverseSpace[];
  defaultProfileId: string | null;
  searchTemplate: string;
  tabs: UniverseTab[];
  isPrivateWindow: (windowId: string) => boolean;
  routeProfileId: (url: string) => string | null;
  openUrl: (url: string, profileId: string) => void;
  selectTab: (tabId: string, windowId: string) => void;
  focusProfileWindow: (profileId: string) => void;
};

const MAX_LENGTH = 8192;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUniverseLink(link: string): boolean {
  return link.trim().toLowerCase().startsWith("universe://");
}

function firstParams(link: string): Map<string, string> | null {
  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    return null;
  }
  const params = new Map<string, string>();
  const query = parsed.search.startsWith("?") ? parsed.search.slice(1) : parsed.search;
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const equals = pair.indexOf("=");
    const rawName = equals < 0 ? pair : pair.slice(0, equals);
    const rawValue = equals < 0 ? "" : pair.slice(equals + 1);
    let name: string;
    let value: string;
    try {
      name = decodeURIComponent(rawName);
      value = decodeURIComponent(rawValue);
    } catch {
      continue;
    }
    if (!params.has(name)) params.set(name, value);
  }
  return params;
}

function takeParam(params: Map<string, string>, key: string): string | null {
  const value = params.get(key);
  if (value === undefined) return null;
  params.delete(key);
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed.length > MAX_LENGTH ? null : trimmed;
}

export function parseUniverseLink(link: string): UniverseLinkCommand | null {
  let parsed: URL;
  try {
    parsed = new URL(link.trim());
  } catch {
    return null;
  }
  if (parsed.protocol.toLowerCase() !== "universe:") return null;
  const params = firstParams(link.trim());
  if (!params) return null;
  const rawSpace = params.get("space");
  if (rawSpace !== undefined) {
    const trimmed = rawSpace.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) return null;
  }
  const host = parsed.hostname.toLowerCase();
  let action: UniverseLinkAction;
  let space: string | undefined;
  if (host === "open") {
    const raw = takeParam(params, "url");
    const url = raw === null ? null : webUrl(raw);
    if (!url) return null;
    action = { kind: "open", url, reuse: takeParam(params, "reuse") === "1" };
    space = takeParam(params, "space") ?? undefined;
  } else if (host === "search") {
    const query = takeParam(params, "q");
    if (query === null) return null;
    action = { kind: "search", query };
    space = takeParam(params, "space") ?? undefined;
  } else if (host === "space") {
    const name = takeParam(params, "name");
    if (name === null) return null;
    action = { kind: "switchSpace" };
    space = name;
  } else {
    return null;
  }
  return { action, ...(space !== undefined ? { space } : {}), ignored: [...params.keys()].sort() };
}

export function webUrl(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  return url.toString();
}

export function universeSearchUrl(query: string, template: string): string | null {
  if (!template.includes("%@")) return webUrl(template);
  return webUrl(template.replace("%@", encodeURIComponent(query)));
}

export function matchUniverseSpace(text: string, spaces: UniverseSpace[]): string | null {
  if (UUID_PATTERN.test(text)) {
    const byId = spaces.find((space) => space.id.toLowerCase() === text.toLowerCase());
    if (byId) return byId.id;
  }
  return spaces.find((space) => space.name.toLowerCase() === text.toLowerCase())?.id ?? null;
}

export function isSamePage(a: string, b: string): boolean {
  const key = (text: string): string | null => {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.protocol.toLowerCase()}//${url.hostname.toLowerCase()}${path}${url.search}`;
  };
  const left = key(a);
  const right = key(b);
  return left !== null && left === right;
}

export function handleUniverseLink(link: string, ctx: UniverseLinkContext): boolean {
  if (!ctx.allowed) return false;
  const command = parseUniverseLink(link);
  if (!command) return false;
  let profileId = ctx.defaultProfileId;
  if (command.space !== undefined) {
    const matched = matchUniverseSpace(command.space, ctx.spaces);
    if (!matched) return false;
    profileId = matched;
  }
  if (command.action.kind === "switchSpace") {
    if (!profileId) return false;
    ctx.focusProfileWindow(profileId);
    return true;
  }
  const url =
    command.action.kind === "open"
      ? command.action.url
      : universeSearchUrl(command.action.query, ctx.searchTemplate);
  if (!url) return false;
  if (command.space === undefined) profileId = ctx.routeProfileId(url) ?? profileId;
  if (!profileId) return false;
  if (command.action.kind === "open" && command.action.reuse) {
    const tab = ctx.tabs.find(
      (candidate) =>
        candidate.profileId === profileId && !ctx.isPrivateWindow(candidate.windowId) && isSamePage(candidate.url, url),
    );
    if (tab) {
      ctx.selectTab(tab.id, tab.windowId);
      return true;
    }
  }
  ctx.openUrl(url, profileId);
  return true;
}
