import { cleanUrl } from "./cleanUrl.ts";

export type RemoveParamKind = { kind: "all" } | { kind: "name"; name: string } | { kind: "regex"; pattern: string; flags: string };

export type RemoveParamRule = {
  host: string | null;
  pathHint: string | null;
  param: RemoveParamKind;
  permittedDomains: string[];
  restrictedDomains: string[];
  isException: boolean;
};

export type RemoveParamRules = {
  hostRules: Map<string, RemoveParamRule[]>;
  genericRules: RemoveParamRule[];
  ruleCount: number;
};

const IGNORED_OPTIONS = new Set(["doc", "document", "~third-party", "3p", "~3p", "third-party", "first-party", "1p", "~1p", "important"]);

function parseParamRegex(value: string): RemoveParamKind | null {
  if (!value.startsWith("/") || value.length <= 2) return null;
  const end = value.lastIndexOf("/");
  if (end <= 0) return null;
  const body = value.slice(1, end);
  const flags = value.slice(end + 1);
  if (body.length > 200) return null;
  try {
    new RegExp(body, flags.includes("i") ? "i" : "");
  } catch {
    return null;
  }
  return { kind: "regex", pattern: body, flags: flags.includes("i") ? "i" : "" };
}

function parseRemoveParamRule(raw: string): RemoveParamRule | null {
  let line = raw.trim();
  if (!line || line.startsWith("!") || line.includes("##") || line.includes("#$#") || !line.includes("removeparam")) return null;
  const isException = line.startsWith("@@");
  if (isException) line = line.slice(2);
  const dollar = line.lastIndexOf("$");
  if (dollar < 0) return null;
  const pattern = line.slice(0, dollar);
  const options = line.slice(dollar + 1).split(",");
  let param: RemoveParamKind | null = null;
  const permitted: string[] = [];
  const restricted: string[] = [];
  for (const opt of options) {
    if (opt === "removeparam") {
      param = { kind: "all" };
    } else if (opt.startsWith("removeparam=")) {
      const value = opt.slice("removeparam=".length);
      if (value.startsWith("~")) return null;
      if (value.startsWith("/")) {
        param = parseParamRegex(value);
        if (!param) return null;
      } else {
        param = { kind: "name", name: value };
      }
    } else if (opt.startsWith("domain=")) {
      for (const d of opt.slice("domain=".length).split("|")) {
        if (d.startsWith("~")) restricted.push(d.slice(1).toLowerCase());
        else permitted.push(d.toLowerCase());
      }
    } else if (IGNORED_OPTIONS.has(opt) || opt.startsWith("app=")) {
      continue;
    } else {
      return null;
    }
  }
  if (!param) return null;
  let host: string | null = null;
  let pathHint: string | null = null;
  if (pattern.startsWith("||")) {
    const rest = pattern.slice(2);
    const hostEnd = [...rest].findIndex((c) => c === "^" || c === "/" || c === "*" || c === "?");
    const end = hostEnd < 0 ? rest.length : hostEnd;
    host = rest.slice(0, end).toLowerCase();
    let hint = rest.slice(end).replace(/^\^/, "").replaceAll("*", "");
    if (hint) pathHint = hint;
  } else if (pattern && pattern !== "*") {
    let hint = pattern.replaceAll("*", "");
    if (hint.startsWith("|")) hint = hint.slice(1);
    if (hint.endsWith("|")) hint = hint.slice(0, -1);
    if (hint) pathHint = hint;
  }
  if (param.kind === "all" && host === null && pathHint === null && permitted.length === 0) return null;
  return { host, pathHint, param, permittedDomains: permitted, restrictedDomains: restricted, isException };
}

export function parseRemoveParamRules(lines: readonly string[]): RemoveParamRules {
  const hostRules = new Map<string, RemoveParamRule[]>();
  const genericRules: RemoveParamRule[] = [];
  let ruleCount = 0;
  for (const line of lines) {
    const rule = parseRemoveParamRule(line);
    if (!rule) continue;
    ruleCount += 1;
    if (rule.host) {
      const list = hostRules.get(rule.host) ?? [];
      list.push(rule);
      hostRules.set(rule.host, list);
    } else {
      genericRules.push(rule);
    }
  }
  return { hostRules, genericRules, ruleCount };
}

function ruleMatches(rule: RemoveParamRule, urlString: string, host: string): boolean {
  if (rule.host && !(host === rule.host || host.endsWith(`.${rule.host}`))) return false;
  if (rule.pathHint && !urlString.includes(rule.pathHint)) return false;
  for (const d of rule.restrictedDomains) if (host === d || host.endsWith(`.${d}`)) return false;
  if (rule.permittedDomains.length && !rule.permittedDomains.some((d) => host === d || host.endsWith(`.${d}`))) return false;
  return true;
}

function paramMatches(param: RemoveParamKind, name: string, value: string | null): boolean {
  if (param.kind === "all") return true;
  if (param.kind === "name") return name === param.name;
  const re = new RegExp(param.pattern, param.flags);
  const pair = value === null ? name : `${name}=${value}`;
  return re.test(pair) || re.test(name);
}

export function stripTrackingParams(url: string, rules: RemoveParamRules): string | null {
  if (!rules.ruleCount) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  const items = [...parsed.searchParams.entries()];
  if (!items.length) return null;
  const candidates = [...rules.genericRules];
  let h = host;
  for (;;) {
    const list = rules.hostRules.get(h);
    if (list) candidates.push(...list);
    const dot = h.indexOf(".");
    if (dot < 0 || !h.slice(dot + 1).includes(".")) break;
    h = h.slice(dot + 1);
  }
  const applicable = candidates.filter((r) => ruleMatches(r, url, host));
  if (!applicable.some((r) => !r.isException)) return null;
  const exceptions = applicable.filter((r) => r.isException);
  if (exceptions.some((r) => r.param.kind === "all")) return null;
  const blocking = applicable.filter((r) => !r.isException);
  const kept = items.filter(([name, value]) => {
    const removed = blocking.some((r) => paramMatches(r.param, name, value));
    const excepted = exceptions.some((r) => paramMatches(r.param, name, value));
    return !(removed && !excepted);
  });
  if (kept.length === items.length) return null;
  const next = new URL(url);
  next.search = "";
  for (const [name, value] of kept) next.searchParams.append(name, value);
  return next.toString();
}

export function cleanUrlWithRemoveParam(url: string, rules: RemoveParamRules): string {
  const stripped = stripTrackingParams(url, rules);
  return cleanUrl(stripped ?? url);
}

export function extractRemoveParamLines(filterText: string): string[] {
  return filterText.split("\n").filter((line) => line.includes("removeparam"));
}
