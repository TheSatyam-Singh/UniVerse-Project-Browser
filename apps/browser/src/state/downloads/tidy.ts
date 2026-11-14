export const TIDY_NAME_MAX_LENGTH = 60;
export const TIDY_NAMER_TIMEOUT_MS = 1500;

export type TidyDownloadInput = {
  url: string;
  filename: string;
  mimeType?: string;
};

export type TidyNamer = (download: TidyDownloadInput) => Promise<string | null>;

const GENERIC_STEMS = new Set([
  "download",
  "file",
  "image",
  "img",
  "document",
  "doc",
  "untitled",
  "unnamed",
  "export",
  "attachment",
  "media",
  "video",
  "photo",
  "scan",
  "output",
]);

const MESSY_PATTERNS = [/[0-9a-f]{8,}/, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/, /\d{6,}/, /\s?\(\d+\)$/, /^(img|dsc|pxl|screenshot|image|file|download)[_\-\s]?\d+/];

export function tidyFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0) return "";
  const last = filename.slice(lastDot + 1);
  const before = filename.slice(0, lastDot);
  const innerDot = before.lastIndexOf(".");
  const inner = innerDot >= 0 ? before.slice(innerDot + 1) : "";
  return inner.toLowerCase() === "tar" ? `${inner}.${last}` : last;
}

export function shouldTidyDownload(isAutomaticFolder: boolean, isPrivate: boolean, origin: "network" | "local"): boolean {
  return isAutomaticFolder && !isPrivate && origin === "network";
}

export function isMessyFilename(filename: string): boolean {
  const ext = tidyFileExtension(filename);
  const stem = ext ? filename.slice(0, filename.length - ext.length - 1) : filename;
  const lower = stem.toLowerCase().trim();
  if (GENERIC_STEMS.has(lower)) return true;
  return MESSY_PATTERNS.some((pattern) => pattern.test(lower));
}

export function acceptedTidyName(proposal: string, original: string): string | null {
  let stem = proposal.split("\n")[0]!.trim().replace(/^["'`]+|["'`]+$/g, "");
  stem = stem.replace(/[/:\\\x00]/g, " ").replace(/\s+/g, " ").trim();
  if (!stem || stem.startsWith(".")) return null;
  const ext = tidyFileExtension(original);
  if (ext && stem.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) stem = stem.slice(0, stem.length - ext.length - 1);
  if (!ext) stem = stem.replace(/\.\w{1,5}$/, "");
  stem = stem.replace(/^[. ]+|[. ]+$/g, "");
  if (stem.length > TIDY_NAME_MAX_LENGTH) stem = stem.slice(0, TIDY_NAME_MAX_LENGTH).trim();
  if (!/[A-Za-z]/.test(stem) || stem.startsWith(".")) return null;
  const name = ext ? `${stem}.${ext}` : stem;
  return name.toLowerCase() === original.toLowerCase() ? null : name;
}

export async function proposeTidyName(download: TidyDownloadInput, namer: TidyNamer | null): Promise<string | null> {
  if (!namer || !isMessyFilename(download.filename)) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), TIDY_NAMER_TIMEOUT_MS);
  });
  try {
    const proposal = await Promise.race([namer(download), timeout]);
    if (proposal === null) return null;
    return acceptedTidyName(proposal, download.filename);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function recordTidyRename<T extends { filename: string; renamedFrom?: string }>(download: T, tidyName: string): T {
  return { ...download, filename: tidyName, renamedFrom: download.filename };
}
