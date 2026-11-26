import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useTab } from "../../state/browser/hooks";
import { tabDestination } from "../../state/pages/urls";
import { pdfFileOf } from "../../state/pdf/pdfUrls";
import { loadPdfDocument, paragraphsOf, type PdfDocumentInfo, type PdfOutlineItem } from "../../state/pdf/pdfDocument";
import { HIGHLIGHT_COLORS, usePdfAnnotations, type HighlightColor } from "../../state/pdf/pdfAnnotations";
import { openExternalURL } from "../../platform/app";
import { sharePage } from "../../platform/share";
import { Button, Checkbox, PopUp, SearchField, Segmented, Text, TextField, useTheme, space, radius, withAlpha } from "../ui";

const ISSUES_URL = "https://github.com/TheSatyam-Singh/UniVerse-Project-Browser/issues/new?labels=pdf-viewer&title=PDF+viewer+issue";
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const BASE_FONT = 15;

type Match = { page: number; index: number };

function splitMatches(text: string, query: string): { text: string; match: boolean }[] {
  if (!query) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const out: { text: string; match: boolean }[] = [];
  let at = 0;
  let i = lower.indexOf(q, at);
  while (i >= 0) {
    if (i > at) out.push({ text: text.slice(at, i), match: false });
    out.push({ text: text.slice(i, i + q.length), match: true });
    at = i + q.length;
    i = lower.indexOf(q, at);
  }
  if (at < text.length) out.push({ text: text.slice(at), match: false });
  return out;
}

function findMatches(doc: PdfDocumentInfo, query: string): Match[] {
  if (!query) return [];
  const q = query.toLowerCase();
  const out: Match[] = [];
  for (const p of doc.pages) {
    const lower = p.text.toLowerCase();
    let i = lower.indexOf(q);
    while (i >= 0) {
      out.push({ page: p.page, index: i });
      i = lower.indexOf(q, i + q.length);
    }
  }
  return out;
}

function OutlineTree({ items, depth, onJump }: { items: PdfOutlineItem[]; depth: number; onJump: (page: number) => void }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={`${depth}-${i}`} style={{ paddingLeft: depth * 14 }}>
          <Button
            variant="text"
            title={item.title}
            look="panel"
            onPress={() => item.page > 0 && onJump(item.page)}
          />
          {item.items.length > 0 && <OutlineTree items={item.items} depth={depth + 1} onJump={onJump} />}
        </View>
      ))}
    </View>
  );
}

export function PdfViewerPage({ tabId }: { tabId: string }) {
  const theme = useTheme();
  const url = useTab(tabId, (t) => (t ? tabDestination(t) : ""));
  const pdfUrl = useMemo(() => pdfFileOf(url), [url]);
  const [doc, setDoc] = useState<PdfDocumentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"thumbs" | "outline" | "notes" | "form">("thumbs");
  const [findOpen, setFindOpen] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlightColor, setHighlightColor] = useState<HighlightColor>("yellow");
  const highlights = usePdfAnnotations((s) => (pdfUrl ? (s.highlights[pdfUrl] ?? []) : []));
  const fieldValues = usePdfAnnotations((s) => (pdfUrl ? (s.fieldValues[pdfUrl] ?? {}) : {}));
  const toggleHighlight = usePdfAnnotations((s) => s.toggleHighlight);
  const removeHighlight = usePdfAnnotations((s) => s.removeHighlight);
  const setFieldValue = usePdfAnnotations((s) => s.setFieldValue);
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const pageTops = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (!pdfUrl) {
      setLoading(false);
      setError("No PDF file was given.");
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setDoc(null);
    setPage(1);
    loadPdfDocument(pdfUrl, ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setDoc(d);
        setLoading(false);
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Could not load the PDF.");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [pdfUrl]);

  const matches = useMemo(() => (doc ? findMatches(doc, query) : []), [doc, query]);
  const currentMatch = matches.length > 0 ? matches[matchIndex % matches.length] : null;

  useEffect(() => {
    if (currentMatch) setPage(currentMatch.page);
  }, [currentMatch]);

  const jumpToPage = (n: number) => {
    if (!doc) return;
    const target = Math.max(1, Math.min(doc.pageCount, n));
    setPage(target);
    const y = pageTops.current.get(target);
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  };

  const zoomLabel = `${Math.round(zoom * 100)}%`;
  const zoomStep = (dir: 1 | -1) => {
    const i = ZOOM_STEPS.findIndex((z) => z >= zoom);
    const next = dir === 1 ? ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, (i < 0 ? 2 : i) + 1)]! : ZOOM_STEPS[Math.max(0, (i < 0 ? 2 : i) - 1)]!;
    setZoom(next);
  };

  const title = doc?.title ?? decodeURIComponent(pdfUrl.split("/").pop() ?? "PDF").split(/[?#]/)[0] ?? "PDF";
  const fileName = pdfUrl.split("/").pop()?.split(/[?#]/)[0] ?? "";

  return (
    <View style={{ flex: 1, backgroundColor: theme.card }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.s, paddingHorizontal: space.m, paddingVertical: space.s, borderBottomWidth: 1, borderBottomColor: theme.divider }}>
        <Button variant="icon" icon="sidebar.left" tooltip="Toggle sidebar" active={sidebarOpen} onPress={() => setSidebarOpen(!sidebarOpen)} />
        <Text size="body" weight="semibold" lines={1} style={{ flex: 1 }}>
          {title}
        </Text>
        <Button variant="icon" icon="chevron.left" tooltip="Previous page" disabled={page <= 1} onPress={() => jumpToPage(page - 1)} />
        <Text size="body" tone="textSecondary">
          {doc ? `${page} / ${doc.pageCount}` : "– / –"}
        </Text>
        <Button variant="icon" icon="chevron.right" tooltip="Next page" disabled={!doc || page >= doc.pageCount} onPress={() => jumpToPage(page + 1)} />
        <Button variant="icon" icon="minus.magnifyingglass" tooltip="Zoom out" disabled={zoom <= ZOOM_STEPS[0]!} onPress={() => zoomStep(-1)} />
        <Button variant="text" title={zoomLabel} look="toolbar" onPress={() => setZoom(1)} />
        <Button variant="icon" icon="plus.magnifyingglass" tooltip="Zoom in" disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]!} onPress={() => zoomStep(1)} />
        <Button variant="icon" icon="magnifyingglass" tooltip="Find in document" active={findOpen} onPress={() => setFindOpen(!findOpen)} />
        <Button variant="icon" icon="highlighter" tooltip="Highlight" active={highlightMode} onPress={() => setHighlightMode(!highlightMode)} />
        <Button variant="icon" icon="arrow.down.doc" tooltip="Download" disabled={!pdfUrl} onPress={() => pdfUrl && void sharePage(pdfUrl, title)} />
        <Button variant="icon" icon="square.and.arrow.up" tooltip="Open in system viewer" disabled={!pdfUrl} onPress={() => pdfUrl && void openExternalURL(pdfUrl)} />
        <Button variant="icon" icon="ellipsis" tooltip="More" active={moreOpen} onPress={() => setMoreOpen(!moreOpen)} />
      </View>
      {moreOpen && (
        <View style={{ flexDirection: "row", gap: space.s, paddingHorizontal: space.m, paddingVertical: space.xs, borderBottomWidth: 1, borderBottomColor: theme.divider }}>
          <Button variant="text" title="Print…" look="toolbar" onPress={() => pdfUrl && void openExternalURL(pdfUrl)} />
          <Button variant="text" title="Report an issue" look="toolbar" onPress={() => void openExternalURL(ISSUES_URL)} />
        </View>
      )}
      <View style={{ flexDirection: "row", gap: space.s, alignItems: "center", paddingHorizontal: space.m, paddingVertical: space.s, backgroundColor: withAlpha(theme.warning, 0.15), borderBottomWidth: 1, borderBottomColor: theme.divider }}>
        <Text size="caption" weight="semibold">
          This PDF viewer is in beta — you might see errors.
        </Text>
        <Button variant="text" title="Report an issue" look="toolbar" onPress={() => void openExternalURL(ISSUES_URL)} />
      </View>
      {highlightMode && (
        <View style={{ flexDirection: "row", gap: space.s, alignItems: "center", paddingHorizontal: space.m, paddingVertical: space.s, borderBottomWidth: 1, borderBottomColor: theme.divider }}>
          {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((c) => (
            <Pressable
              key={c}
              onPress={() => setHighlightColor(c)}
              style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: HIGHLIGHT_COLORS[c], borderWidth: highlightColor === c ? 2 : 1, borderColor: highlightColor === c ? theme.textPrimary : theme.divider }}
              accessibilityLabel={`${c} highlight`}
            />
          ))}
          <Text size="caption" tone="textSecondary">
            Tap a paragraph to highlight it. Tap again to remove.
          </Text>
        </View>
      )}
      {findOpen && (
        <View style={{ flexDirection: "row", gap: space.s, alignItems: "center", paddingHorizontal: space.m, paddingVertical: space.s, borderBottomWidth: 1, borderBottomColor: theme.divider }}>
          <SearchField value={query} onChangeText={(t) => { setQuery(t); setMatchIndex(0); }} placeholder="Find in document" autoFocus width={260} />
          <Text size="caption" tone="textSecondary">
            {matches.length > 0 ? `${(matchIndex % matches.length) + 1} of ${matches.length}` : query ? "No matches" : ""}
          </Text>
          <Button variant="icon" icon="chevron.up" tooltip="Previous match" disabled={matches.length === 0} onPress={() => setMatchIndex((i) => (i - 1 + matches.length) % matches.length)} />
          <Button variant="icon" icon="chevron.down" tooltip="Next match" disabled={matches.length === 0} onPress={() => setMatchIndex((i) => (i + 1) % matches.length)} />
          <Button variant="close" look="panel" onPress={() => { setFindOpen(false); setQuery(""); }} />
        </View>
      )}
      <View style={{ flex: 1, flexDirection: "row" }}>
        {sidebarOpen && doc && (
          <View style={{ width: 220, borderRightWidth: 1, borderRightColor: theme.divider, backgroundColor: theme.panel }}>
            <View style={{ padding: space.s }}>
              <Segmented
                options={[
                  { value: "thumbs", title: "Pages" },
                  { value: "outline", title: "Outline" },
                  { value: "notes", title: "Notes" },
                  { value: "form", title: "Form" },
                ]}
                value={sidebarTab}
                onChange={setSidebarTab}
              />
            </View>
            <ScrollView style={{ flex: 1 }}>
              {sidebarTab === "thumbs" ? (
                <View style={{ padding: space.s, gap: space.s }}>
                  {doc.pages.map((p) => (
                    <Button
                      key={p.page}
                      variant="text"
                      title={`${p.page}. ${(p.text.trim().slice(0, 60) || "(blank page)")}`}
                      look="panel"
                      onPress={() => jumpToPage(p.page)}
                    />
                  ))}
                </View>
              ) : sidebarTab === "outline" ? (
                doc.outline.length > 0 ? (
                  <View style={{ padding: space.s }}>
                    <OutlineTree items={doc.outline} depth={0} onJump={jumpToPage} />
                  </View>
                ) : (
                  <View style={{ padding: space.m }}>
                    <Text size="caption" tone="textSecondary">
                      This document has no outline.
                    </Text>
                  </View>
                )
              ) : sidebarTab === "notes" ? (
                <View style={{ padding: space.s, gap: space.s }}>
                  {highlights.length === 0 ? (
                    <View style={{ padding: space.m }}>
                      <Text size="caption" tone="textSecondary">
                        No highlights yet. Turn on Highlight and tap a paragraph to add one.
                      </Text>
                    </View>
                  ) : (
                    highlights.map((h) => {
                      const para = paragraphsOf(doc.pages[h.page - 1]?.text ?? "")[h.para] ?? "";
                      return (
                        <View key={h.id} style={{ flexDirection: "row", gap: space.s, alignItems: "center", padding: space.s, backgroundColor: withAlpha(HIGHLIGHT_COLORS[h.color], 0.25), borderRadius: radius.control }}>
                          <Button variant="text" title={`p${h.page} · ${para.slice(0, 48)}${para.length > 48 ? "…" : ""}`} look="panel" onPress={() => jumpToPage(h.page)} />
                          <Button variant="icon" icon="trash" tooltip="Remove highlight" onPress={() => removeHighlight(pdfUrl, h.id)} />
                        </View>
                      );
                    })
                  )}
                </View>
              ) : doc.fields.length > 0 ? (
                <View style={{ padding: space.s, gap: space.m }}>
                  <View style={{ paddingHorizontal: space.s }}>
                    <Text size="caption" tone="textSecondary">
                      Filled values stay in this viewer for now — export to a filled PDF is coming next.
                    </Text>
                  </View>
                  {doc.fields.map((f) => {
                    const stored = fieldValues[f.name];
                    if (f.kind === "text") {
                      return (
                        <View key={`${f.page}-${f.name}`} style={{ gap: space.xs, paddingHorizontal: space.s }}>
                          <Text size="caption" tone="textSecondary">
                            {f.name} · p{f.page}
                          </Text>
                          <TextField value={typeof stored === "string" ? stored : f.value} onChangeText={(v) => setFieldValue(pdfUrl, f.name, v)} placeholder={f.name} />
                        </View>
                      );
                    }
                    if (f.kind === "checkbox") {
                      const checked = typeof stored === "boolean" ? stored : f.value !== "Off";
                      return (
                        <View key={`${f.page}-${f.name}`} style={{ paddingHorizontal: space.s }}>
                          <Checkbox value={checked} onChange={(v) => setFieldValue(pdfUrl, f.name, v)} label={`${f.name} · p${f.page}`} />
                        </View>
                      );
                    }
                    return (
                      <View key={`${f.page}-${f.name}`} style={{ gap: space.xs, paddingHorizontal: space.s }}>
                        <Text size="caption" tone="textSecondary">
                          {f.name} · p{f.page}
                        </Text>
                        <PopUp
                          value={typeof stored === "string" ? stored : f.value}
                          options={f.options.map((o) => ({ value: o, title: o }))}
                          onChange={(v) => setFieldValue(pdfUrl, f.name, v)}
                        />
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={{ padding: space.m }}>
                  <Text size="caption" tone="textSecondary">
                    This document has no fillable form fields.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: space.m, gap: space.m, alignItems: "center" }}>
          {loading && (
            <Text size="body" tone="textSecondary">
              Loading PDF…
            </Text>
          )}
          {error && (
            <View style={{ maxWidth: 560, gap: space.s }}>
              <Text size="body" weight="semibold">
                Could not open this PDF.
              </Text>
              <Text size="body" tone="textSecondary">
                {error}
              </Text>
              <Text size="caption" tone="textSecondary">
                The viewer fetches the file directly, so a server that blocks cross-origin reads will refuse it. Downloading the file or opening it in the system viewer still works.
              </Text>
              <View style={{ flexDirection: "row", gap: space.s }}>
                <Button variant="text" title="Download" look="toolbar" onPress={() => pdfUrl && void sharePage(pdfUrl, title)} />
                <Button variant="text" title="Open in system viewer" look="toolbar" onPress={() => pdfUrl && void openExternalURL(pdfUrl)} />
              </View>
            </View>
          )}
          {doc &&
            doc.pages.map((p) => (
              <View
                key={p.page}
                onLayout={(e) => pageTops.current.set(p.page, e.nativeEvent.layout.y)}
                style={{ width: "100%", maxWidth: 760, backgroundColor: theme.panel, borderRadius: radius.control, borderWidth: 1, borderColor: theme.divider, padding: space.m }}
              >
                <Text size="caption" tone="textSecondary" style={{ marginBottom: space.s }}>
                  Page {p.page} of {doc.pageCount}
                </Text>
                {paragraphsOf(p.text).map((para, pi) => {
                  const hl = highlights.find((h) => h.page === p.page && h.para === pi);
                  const body = (
                    <Text size="body" style={{ fontSize: BASE_FONT * zoom, lineHeight: BASE_FONT * zoom * 1.6, backgroundColor: hl ? withAlpha(HIGHLIGHT_COLORS[hl.color], 0.35) : undefined }}>
                      {splitMatches(para, query).map((seg, i) =>
                        seg.match ? (
                          <Text key={i} style={{ backgroundColor: theme.searchFlash, fontSize: BASE_FONT * zoom, lineHeight: BASE_FONT * zoom * 1.6 }}>
                            {seg.text}
                          </Text>
                        ) : (
                          <Text key={i} style={{ fontSize: BASE_FONT * zoom, lineHeight: BASE_FONT * zoom * 1.6 }}>
                            {seg.text}
                          </Text>
                        ),
                      )}
                    </Text>
                  );
                  return highlightMode ? (
                    <Pressable key={pi} onPress={() => toggleHighlight(pdfUrl, p.page, pi, highlightColor)} style={{ marginBottom: space.s }}>
                      {body}
                    </Pressable>
                  ) : (
                    <View key={pi} style={{ marginBottom: space.s }}>
                      {body}
                    </View>
                  );
                })}
                {p.page === 1 && (
                  <Text size="caption" tone="textSecondary" style={{ marginTop: space.m }}>
                    Visual page rendering is coming next — this build reads the document text. Use the system viewer for the exact layout.
                  </Text>
                )}
              </View>
            ))}
          {doc && doc.pages.length === 0 && (
            <Text size="body" tone="textSecondary">
              This PDF has no pages.
            </Text>
          )}
          {!loading && !error && !doc && !pdfUrl && (
            <Text size="body" tone="textSecondary">
              Open a PDF file to view it here.
            </Text>
          )}
        </ScrollView>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: space.m, paddingVertical: space.xs, borderTopWidth: 1, borderTopColor: theme.divider }}>
        <Text size="caption" tone="textSecondary">
          {fileName || "PDF"}
          {doc?.author ? ` · ${doc.author}` : ""}
        </Text>
        <Text size="caption" tone="textSecondary">
          {doc ? `${doc.pageCount} pages` : ""}
        </Text>
      </View>
    </View>
  );
}
