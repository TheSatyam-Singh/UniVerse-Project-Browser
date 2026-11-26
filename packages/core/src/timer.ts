const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
  m: 60,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hour: 3600,
  hours: 3600,
};

const PAIR = /(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)(?![a-z])/gi;
const FULL_UNIT_PHRASE = /^\s*\d+(?:\.\d+)?\s*(second|seconds|minute|minutes|hour|hours)\s*$/i;

export type ParsedTimer = { seconds: number; label: string };

export function humanizeDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds);
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const hourPart = `${hours} hour${hours === 1 ? '' : 's'}`;
    return minutes ? `${hourPart} ${minutes} minute${minutes === 1 ? '' : 's'}` : hourPart;
  }
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    const minutePart = `${minutes} minute${minutes === 1 ? '' : 's'}`;
    return rest ? `${minutePart} ${rest} second${rest === 1 ? '' : 's'}` : minutePart;
  }
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

export function parseTimer(raw: string): ParsedTimer | null {
  const query = raw.trim();
  if (!query || query.length > 100) return null;
  const lower = query.toLowerCase();
  const mentionsTimer = /\btimer\b/.test(lower);
  if (!mentionsTimer && !FULL_UNIT_PHRASE.test(query)) return null;
  const stripped = lower.replace(/\btimer\b/g, ' ');
  let total = 0;
  let found = false;
  for (const match of stripped.matchAll(PAIR)) {
    const amount = Number(match[1]);
    const unit = UNIT_SECONDS[match[2]!.toLowerCase()];
    if (!Number.isFinite(amount) || unit === undefined) continue;
    total += amount * unit;
    found = true;
  }
  if (!found || total <= 0) return null;
  const seconds = Math.min(Math.max(Math.round(total), 1), 86400);
  return { seconds, label: humanizeDuration(seconds) };
}
