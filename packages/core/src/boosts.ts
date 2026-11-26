export type JsonSchema = {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  items?: JsonSchema | boolean;
  properties?: Record<string, JsonSchema>;
  additionalProperties?: JsonSchema | boolean;
  required?: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';

export type Boost = { id: string; name: string; host: string; css: string; enabled: boolean };

export function isBoost(value: unknown): value is Boost {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.host) &&
    isString(value.css) &&
    typeof value.enabled === 'boolean'
  );
}

export function isBoostList(value: unknown): value is Boost[] {
  return Array.isArray(value) && value.every(isBoost);
}

export const BOOSTS_SCHEMA: JsonSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      host: { type: 'string' },
      css: { type: 'string' },
      enabled: { type: 'boolean' },
    },
    required: ['id', 'name', 'host', 'css', 'enabled'],
  },
};

export function newBoostId(): string {
  return `boost-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}

export function normalizeBoostHost(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, '');
}

export function boostMatchesHost(boost: Boost, pageHost: string): boolean {
  const wanted = normalizeBoostHost(boost.host);
  if (!wanted) return false;
  const host = normalizeBoostHost(pageHost);
  return host === wanted || host.endsWith(`.${wanted}`);
}

export function boostsForHost(boosts: readonly Boost[], pageHost: string): Boost[] {
  return boosts.filter((b) => b.enabled && boostMatchesHost(b, pageHost));
}

export function boostShareText(boost: Boost): string {
  return JSON.stringify({ name: boost.name, host: boost.host, css: boost.css }, null, 2);
}

export function parseBoostShare(text: string): Boost[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  if (!entries.length) return null;
  const out: Boost[] = [];
  for (const entry of entries) {
    if (!isRecord(entry) || !isString(entry.name) || !isString(entry.host) || !isString(entry.css)) return null;
    if (!entry.name.trim() || !normalizeBoostHost(entry.host) || !entry.css.trim()) return null;
    out.push({ id: newBoostId(), name: entry.name.trim(), host: normalizeBoostHost(entry.host), css: entry.css, enabled: true });
  }
  return out;
}
