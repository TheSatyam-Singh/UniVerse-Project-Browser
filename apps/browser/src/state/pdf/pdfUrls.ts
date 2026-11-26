export function isPdfUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }
  if (parsed && parsed.protocol === "file:") return false;
  const path = parsed ? parsed.pathname : (url.split(/[?#]/)[0] ?? "");
  return /\.pdf$/i.test(path);
}

export function pdfViewerUrl(pdfUrl: string): string {
  return `universe://pdf?file=${encodeURIComponent(pdfUrl)}`;
}

export function pdfFileOf(viewerUrl: string): string {
  const m = /[?&]file=([^&#]*)/.exec(viewerUrl);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1] ?? "");
  } catch {
    return m[1] ?? "";
  }
}

export function isPdfViewerUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "universe:" && u.hostname.toLowerCase() === "pdf";
  } catch {
    return false;
  }
}
