import { create } from "zustand";
import { useBrowser } from "../browser/store";

export type AiSource = { title: string; url: string };
export type AiMessage = { id: string; role: "user" | "assistant"; text: string; sources?: AiSource[] };

export function normalizeSearchUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, "");
}

export function searchEndpoint(backendUrl: string): string {
  return `${normalizeSearchUrl(backendUrl)}/api/search`;
}

type SearchAccumulator = {
  feed: (chunk: string) => void;
  snapshot: () => { text: string; sources: AiSource[] };
  result: () => { text: string; sources: AiSource[] };
};

export function createSearchAccumulator(): SearchAccumulator {
  let text = "";
  const sources: AiSource[] = [];
  let buffer = "";
  const pushSource = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const url = typeof record.url === "string" ? record.url : typeof record.source === "string" ? record.source : "";
    if (!url) return;
    const title = typeof record.title === "string" && record.title ? record.title : url;
    if (!sources.some((s) => s.url === url)) sources.push({ title, url });
  };
  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const code = trimmed[0];
    const payload = trimmed.slice(2);
    if (code === "0") {
      try {
        const delta = JSON.parse(payload) as unknown;
        if (typeof delta === "string") text += delta;
      } catch {}
    } else if (code === "8" || code === "a") {
      try {
        const data = JSON.parse(payload) as unknown;
        if (Array.isArray(data)) data.forEach(pushSource);
        else pushSource(data);
      } catch {}
    }
  };
  const snapshot = () => ({ text, sources: [...sources] });
  return {
    feed(chunk: string) {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      lines.forEach(handleLine);
    },
    snapshot,
    result() {
      if (buffer.trim()) handleLine(buffer);
      return snapshot();
    },
  };
}

export async function askUniverse(
  backendUrl: string,
  question: string,
  onText: (text: string, sources: AiSource[]) => void,
  signal?: AbortSignal,
): Promise<{ text: string; sources: AiSource[] }> {
  const endpoint = searchEndpoint(backendUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", parts: [{ type: "text", text: question }] }],
      model: "universe-nano",
    }),
    signal,
  });
  if (!response.ok) throw new Error(`search ${response.status}`);
  const acc = createSearchAccumulator();
  const emit = () => {
    const r = acc.snapshot();
    onText(r.text, r.sources);
  };
  const body = response.body as unknown as { getReader?: () => { read: () => Promise<{ done: boolean; value?: Uint8Array }> } } | null;
  if (body?.getReader) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        acc.feed(decoder.decode(value, { stream: true }));
        emit();
      }
    }
    acc.feed(decoder.decode());
    emit();
  } else {
    acc.feed(await response.text());
    emit();
  }
  return acc.result();
}

type AiSidebarState = {
  open: boolean;
  messages: AiMessage[];
  asking: boolean;
  error: string | null;
  openAi: () => void;
  closeAi: () => void;
  toggleAi: () => void;
  askAi: (question: string) => Promise<void>;
  clearAi: () => void;
};

let messageId = 0;
const nextId = () => `ai-${++messageId}-${Date.now()}`;

export const useAiSidebar = create<AiSidebarState>()((set, get) => ({
  open: false,
  messages: [],
  asking: false,
  error: null,
  openAi: () => set({ open: true }),
  closeAi: () => set({ open: false }),
  toggleAi: () => set((s) => ({ open: !s.open })),
  clearAi: () => set({ messages: [], error: null }),
  askAi: async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || get().asking) return;
    const backendUrl = normalizeSearchUrl(useBrowser.getState().settings.aiSearchUrl ?? "");
    const userMessage: AiMessage = { id: nextId(), role: "user", text: trimmed };
    const assistantId = nextId();
    set((s) => ({ messages: [...s.messages, userMessage, { id: assistantId, role: "assistant", text: "" }], asking: true, error: null }));
    if (!backendUrl) {
      set((s) => ({ asking: false, error: "notConfigured", messages: s.messages.filter((m) => m.id !== assistantId) }));
      return;
    }
    try {
      const { text, sources } = await askUniverse(backendUrl, trimmed, (t, src) => {
        set((s) => ({ messages: s.messages.map((m) => (m.id === assistantId ? { ...m, text: t, sources: src.length ? src : undefined } : m)) }));
      });
      set((s) => ({
        asking: false,
        messages: s.messages.map((m) => (m.id === assistantId ? { ...m, text, sources: sources.length ? sources : undefined } : m)),
      }));
    } catch {
      set((s) => ({ asking: false, error: "failed", messages: s.messages.filter((m) => m.id !== assistantId) }));
    }
  },
}));
