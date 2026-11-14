import type { AIMessage, AIResponse } from "./types.ts";

export const CLEAN_TITLE_LENGTH = 24;
export const MAX_ORGANIZER_TABS = 40;
export const MAX_FOLDER_NAME_LENGTH = 40;

export type TabInput = {
  index: number;
  id: string;
  title: string;
  url: string;
};

export type ExistingFolder = {
  id: string;
  name: string;
  sampleTitles: string[];
};

export type OrganizationGroup = {
  name: string;
  existingFolderId?: string;
  tabs: number[];
};

export type OrganizationRename = {
  tab: number;
  name: string;
};

export type TabOrganizationPlan = {
  groups: OrganizationGroup[];
  renames: OrganizationRename[];
  duplicates: number[];
};

const GENERIC_NAMES: ReadonlySet<string> = new Set([
  "general",
  "miscellaneous",
  "misc",
  "other",
  "others",
  "various",
  "personal",
  "technology",
  "tech",
  "web",
  "internet",
  "online",
  "content & media",
  "media",
  "resources",
  "reference",
  "browsing",
  "websites",
]);

const UNRELATED = "Unrelated";

export function pageKey(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  let host = (parsed.hostname ?? "").toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);
  let path = parsed.pathname ?? "";
  while (path.endsWith("/")) path = path.slice(0, -1);
  return `${host}${path}?${parsed.search ?? ""}#${parsed.hash ?? ""}`;
}

export function duplicatesIn(inputs: TabInput[], filedUrls: string[] = []): number[] {
  const seen = new Set(filedUrls.map(pageKey));
  const duplicates: number[] = [];
  for (const input of inputs) {
    if (!seen.has(pageKey(input.url))) {
      seen.add(pageKey(input.url));
    } else {
      duplicates.push(input.index);
    }
  }
  return duplicates;
}

export function registrableDomain(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
  if (host.startsWith("www.")) host = host.slice(4);
  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return host;
  const last = labels[labels.length - 1] ?? "";
  const secondLast = labels[labels.length - 2] ?? "";
  const countrySuffix = last.length === 2 && ["co", "com", "net", "org", "ac", "gov", "edu"].includes(secondLast);
  return labels.slice(countrySuffix ? -3 : -2).join(".");
}

export function shortHost(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return url;
  }
  return host.startsWith("www.") ? host.slice(4) : host;
}

function cleanText(text: string, limit: number): string {
  const flat = text
    .split("\n")
    .join(" ")
    .trim();
  return flat.slice(0, limit);
}

export function cleanFolderName(name: string): string {
  const cleaned = cleanText(name, MAX_FOLDER_NAME_LENGTH).trim();
  if (!cleaned) return "";
  if (cleaned.toLowerCase() === UNRELATED.toLowerCase()) return "";
  if (GENERIC_NAMES.has(cleaned.toLowerCase())) return "";
  return cleaned;
}

export function sameTopic(a: string, b: string): boolean {
  const words = (name: string): Set<string> =>
    new Set(
      name
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .map((w) => (w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w)),
    );
  const x = words(a);
  const y = words(b);
  if (x.size === 0 || y.size === 0) return false;
  return [...x].every((w) => y.has(w)) || [...y].every((w) => x.has(w));
}

export function siteTitleFor(input: TabInput): string | null {
  let path: string[] = [];
  let host = "";
  try {
    const parsed = new URL(input.url);
    path = parsed.pathname.split("/").filter(Boolean);
    host = parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!(path.length === 0 || (path.length === 1 && path[0]!.length <= 12 && !path[0]!.includes("-")))) return null;
  const labels = host
    .split(".")
    .slice(0, -1)
    .filter((label) => label.length > 2 && label !== "www");
  let segments = [input.title];
  for (const separator of [" | ", " - ", " — ", " – ", ": ", " · "]) {
    segments = segments.flatMap((s) => s.split(separator));
  }
  const matches = segments
    .map((segment) => segment.trim())
    .filter((segment) => {
      const flat = segment
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      return labels.some((label) => flat.includes(label));
    })
    .sort((a, b) => a.length - b.length);
  const match = matches[0];
  if (!match || match.length >= input.title.length) return null;
  return match;
}

export function fittedTitle(title: string): string {
  let text = cleanText(title, 200);
  if (text.length > CLEAN_TITLE_LENGTH) {
    const cut = [...text].findIndex((ch) => ":,(".includes(ch));
    if (cut >= 4) text = text.slice(0, cut);
  }
  const stopWords = new Set(["with", "and", "of", "the", "for", "to", "in", "a", "an", "on", "at", "&", "-", "|", ":"]);
  let words = text.split(" ").filter(Boolean);
  while (words.length > 1 && words.join(" ").length > CLEAN_TITLE_LENGTH) words = words.slice(0, -1);
  while (words.length > 1 && stopWords.has((words[words.length - 1] ?? "").toLowerCase())) words = words.slice(0, -1);
  return words.join(" ").slice(0, CLEAN_TITLE_LENGTH).replace(/[ ,:;\-|]+$/, "").trim();
}

const TITLE_STOP_WORDS: ReadonlySet<string> = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "by", "at", "from", "is", "are", "new", "best", "how", "what", "why", "when",
]);

export function significantWords(title: string): string[] {
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !TITLE_STOP_WORDS.has(w));
}

export function rulesGroups(inputs: TabInput[], existingFolders: ExistingFolder[] = []): OrganizationGroup[] {
  const byDomain = new Map<string, TabInput[]>();
  for (const input of inputs) {
    const domain = registrableDomain(input.url);
    if (!domain) continue;
    const list = byDomain.get(domain) ?? [];
    list.push(input);
    byDomain.set(domain, list);
  }
  const groups: OrganizationGroup[] = [];
  for (const [domain, members] of byDomain) {
    if (members.length < 2) continue;
    const wordCounts = new Map<string, number>();
    for (const member of members) {
      for (const word of new Set(significantWords(member.title))) {
        wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
      }
    }
    const shared = [...wordCounts.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]);
    const siteName = shortHost(members[0]!.url).split(".")[0] ?? domain;
    const topicWord = shared[0]?.[0];
    const rawName = topicWord
      ? `${topicWord.charAt(0).toUpperCase()}${topicWord.slice(1)}`
      : siteName.charAt(0).toUpperCase() + siteName.slice(1);
    const name = cleanFolderName(rawName);
    if (!name) continue;
    const existing = existingFolders.find((folder) => sameTopic(folder.name, name) || folder.name.toLowerCase() === name.toLowerCase());
    groups.push({
      name: existing ? existing.name : name,
      existingFolderId: existing?.id,
      tabs: members.map((m) => m.index).sort((a, b) => a - b),
    });
  }
  const seenNames = new Set<string>();
  return groups.filter((group) => {
    const key = group.name.toLowerCase();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });
}

export function rulesRenames(inputs: TabInput[]): OrganizationRename[] {
  const renames: OrganizationRename[] = [];
  for (const input of inputs) {
    if (input.title.length <= CLEAN_TITLE_LENGTH) continue;
    const site = siteTitleFor(input);
    const candidate = site ? fittedTitle(site) : fittedTitle(input.title);
    if (candidate && candidate.length < input.title.length) renames.push({ tab: input.index, name: candidate });
  }
  return renames;
}

export function buildPlan(
  inputs: TabInput[],
  groups: OrganizationGroup[],
  renames: OrganizationRename[],
  duplicates: number[],
): TabOrganizationPlan {
  const valid = new Set(inputs.map((input) => input.index));
  const byIndex = new Map(inputs.map((input) => [input.index, input]));
  const cleanGroups: OrganizationGroup[] = [];
  const usedTabs = new Set<number>();
  for (const group of groups) {
    const name = cleanFolderName(group.name);
    if (!name) continue;
    const tabs = [...new Set(group.tabs)].filter((index) => valid.has(index) && !usedTabs.has(index)).sort((a, b) => a - b);
    if (tabs.length < 2) continue;
    for (const index of tabs) usedTabs.add(index);
    const cleanGroup: OrganizationGroup = { name, tabs };
    if (group.existingFolderId) cleanGroup.existingFolderId = group.existingFolderId;
    cleanGroups.push(cleanGroup);
  }
  const cleanRenames: OrganizationRename[] = [];
  const seenRenames = new Set<number>();
  for (const rename of renames) {
    if (!valid.has(rename.tab) || seenRenames.has(rename.tab)) continue;
    const original = byIndex.get(rename.tab)?.title ?? "";
    const name = fittedTitle(rename.name);
    if (!name || name.length >= original.length) continue;
    seenRenames.add(rename.tab);
    cleanRenames.push({ tab: rename.tab, name });
  }
  const cleanDuplicates = [...new Set(duplicates)].filter((index) => valid.has(index)).sort((a, b) => a - b);
  return { groups: cleanGroups, renames: cleanRenames, duplicates: cleanDuplicates };
}

export function organizerPrompt(inputs: TabInput[], existingFolders: ExistingFolder[]): string {
  const limit = Math.max(3, Math.floor(inputs.length / 3));
  const list = inputs
    .map((input) => `${input.index}. ${cleanText(input.title, 80)} | ${shortHost(input.url)}`)
    .join("\n");
  const folders = existingFolders.length > 0 ? `\nExisting folders (file into one of these when its topic matches, otherwise propose a new folder):\n${existingFolders.map((f) => `- ${f.name}`).join("\n")}` : "";
  return [
    "You organize browser tabs into folders by the specific task or topic the person is working on, never by website. Two tabs from one site often belong to different topics. Judge by the page title.",
    "Tabs about mail, calendars, news, music and video that relate to nothing else stay out of every folder.",
    `Name at most ${limit} folders. Reply with JSON only, in this shape: {"groups": [{"name": "Folder Name", "tabs": [1, 2]}, ...], "renames": [{"tab": 1, "name": "Short title"}]}`,
    "A folder holds at least 2 tabs. Folder names are Title Case, 1 to 3 words, a specific task or topic, never a website name. Renames are at most 4 words and 24 characters, built from words already in the title.",
    `Tabs:\n${list}${folders}`,
  ].join("\n\n");
}

export type ProviderChatFn = (args: { messages: AIMessage[]; model: string }) => Promise<AIResponse>;

export async function classifyWithProvider(
  inputs: TabInput[],
  existingFolders: ExistingFolder[],
  model: string,
  chat: ProviderChatFn,
): Promise<{ groups: OrganizationGroup[]; renames: OrganizationRename[] }> {
  if (inputs.length === 0) return { groups: [], renames: [] };
  const response = await chat({
    messages: [
      { role: "system", content: "You organize browser tabs. Reply with JSON only." },
      { role: "user", content: organizerPrompt(inputs, existingFolders) },
    ],
    model,
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    const match = response.content.match(/\{[\s\S]*\}/);
    if (!match) return { groups: [], renames: [] };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return { groups: [], renames: [] };
    }
  }
  if (!parsed || typeof parsed !== "object") return { groups: [], renames: [] };
  const root = parsed as Record<string, unknown>;
  const groups: OrganizationGroup[] = [];
  if (Array.isArray(root.groups)) {
    for (const entry of root.groups) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      const name = typeof item.name === "string" ? cleanFolderName(item.name) : "";
      if (!name) continue;
      const tabs = Array.isArray(item.tabs) ? item.tabs.filter((t): t is number => typeof t === "number") : [];
      const existing = existingFolders.find((folder) => sameTopic(folder.name, name) || folder.name.toLowerCase() === name.toLowerCase());
      const group: OrganizationGroup = { name: existing ? existing.name : name, tabs };
      if (existing) group.existingFolderId = existing.id;
      groups.push(group);
    }
  }
  const renames: OrganizationRename[] = [];
  if (Array.isArray(root.renames)) {
    for (const entry of root.renames) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      if (typeof item.tab !== "number" || typeof item.name !== "string") continue;
      renames.push({ tab: item.tab, name: item.name });
    }
  }
  return { groups, renames };
}

export function planSummary(plan: TabOrganizationPlan): string {
  return `${plan.groups.length} groups, ${plan.renames.length} renames, ${plan.duplicates.length} duplicates`;
}
